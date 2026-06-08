"""
This module contains evaluation-related routes for the LightRAG API.

Exposes RAGAS evaluation functionality for the WebUI Evaluation panel,
allowing users to run evaluations, check progress, and view results.
"""

from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from lightrag.api.utils_api import get_combined_auth_dependency
from lightrag.utils import logger


class TestCase(BaseModel):
    """A single test case for evaluation."""

    question: str = Field(description="The question to evaluate")
    ground_truth: str = Field(description="The expected/reference answer")
    project: Optional[str] = Field(None, description="Optional project identifier")


class RunEvaluationRequest(BaseModel):
    """Request to run a new evaluation."""

    test_cases: Optional[List[TestCase]] = Field(
        None, description="Test cases to evaluate. If None, uses dataset_filename or sample."
    )
    use_sample_dataset: bool = Field(
        False, description="Use the built-in sample dataset instead of provided test_cases"
    )
    dataset_filename: Optional[str] = Field(
        None, description="Filename of a saved dataset to use (e.g., 'datasets/my_dataset.json')"
    )


class RunEvaluationResponse(BaseModel):
    """Response from starting an evaluation."""

    status: str = Field(description="Status: started, error, or busy")
    eval_id: Optional[str] = Field(None, description="Unique evaluation ID for tracking")
    message: str = Field(description="Status message")
    total_tests: int = Field(0, description="Number of tests to run")


class EvaluationStatus(BaseModel):
    """Status of a running or completed evaluation."""

    status: str = Field(description="Status: running, completed, or failed")
    progress: int = Field(description="Number of tests completed")
    total: int = Field(description="Total number of tests")
    started_at: str = Field(description="ISO timestamp when evaluation started")
    completed_at: Optional[str] = Field(None, description="ISO timestamp when completed")
    result_file: Optional[str] = Field(None, description="Result filename if completed")
    elapsed_time: Optional[float] = Field(None, description="Elapsed time in seconds")
    avg_ragas_score: Optional[float] = Field(None, description="Average RAGAS score")
    error: Optional[str] = Field(None, description="Error message if failed")


class PipelineConfig(BaseModel):
    """Document processing pipeline configuration captured at evaluation time."""

    extraction_engine: Optional[str] = Field(None, description="Document extraction engine (e.g., DEFAULT, docling, docling_vision)")
    chunking_method: Optional[str] = Field(None, description="Chunking method (e.g., TOKEN_SIZE, SEMANTIC, HYBRID)")
    chunk_size: Optional[int] = Field(None, description="Chunk size in tokens")
    chunk_overlap_size: Optional[int] = Field(None, description="Chunk overlap size in tokens")
    vision_enabled: Optional[bool] = Field(None, description="Whether vision model is enabled")
    vision_model: Optional[str] = Field(None, description="Vision model name if enabled")


class ResultFileSummary(BaseModel):
    """Summary of an evaluation result file."""

    filename: str = Field(description="Result filename")
    timestamp: str = Field(description="ISO timestamp of evaluation")
    total_tests: int = Field(description="Number of tests in evaluation")
    elapsed_time: float = Field(description="Total elapsed time in seconds")
    avg_ragas_score: float = Field(description="Average RAGAS score (0-1)")
    success_rate: float = Field(description="Percentage of successful tests (0-100)")
    pipeline_config: Optional[PipelineConfig] = Field(None, description="Pipeline config at time of evaluation")


class ResultsListResponse(BaseModel):
    """Response listing all evaluation results."""

    results: List[ResultFileSummary] = Field(description="List of result file summaries")
    total_count: int = Field(description="Total number of result files")


class EnvironmentStatus(BaseModel):
    """Status of evaluation environment."""

    ragas_available: bool = Field(description="Whether RAGAS is installed")
    eval_llm_api_key_set: bool = Field(description="Whether API key is configured")
    eval_model: str = Field(description="Evaluation LLM model name")
    eval_embedding_model: str = Field(description="Evaluation embedding model name")
    lightrag_api_url: str = Field(description="LightRAG API URL")


class DeleteResultResponse(BaseModel):
    """Response from deleting a result file."""

    status: str = Field(description="Status: success or error")
    message: str = Field(description="Status message")


class DatasetInfo(BaseModel):
    """Information about an available evaluation dataset."""

    filename: str = Field(description="Dataset filename (path relative to evaluation folder)")
    name: str = Field(description="Human-readable dataset name")
    test_count: int = Field(description="Number of test cases in dataset")
    description: str = Field(description="Dataset description")
    is_default: bool = Field(description="Whether this is the default sample dataset")
    source_pdf: Optional[str] = Field(None, description="Source PDF filename if applicable")
    source_pdf_exists: bool = Field(False, description="Whether source PDF exists in source_pdfs/")


class DatasetsListResponse(BaseModel):
    """Response listing all available datasets."""

    datasets: List[DatasetInfo] = Field(description="List of available datasets")
    total_count: int = Field(description="Total number of datasets")


def create_evaluation_routes(api_key: str | None, rag_api_url: str):
    """Create evaluation routes with bound parameters.

    Args:
        api_key: API key for authentication (if configured)
        rag_api_url: URL of the LightRAG API endpoint

    Returns:
        APIRouter: Router with evaluation endpoints
    """
    router = APIRouter(
        prefix="/evaluation",
        tags=["evaluation"],
    )

    combined_auth = get_combined_auth_dependency(api_key)

    @router.get(
        "/environment",
        dependencies=[Depends(combined_auth)],
        response_model=EnvironmentStatus,
        summary="Check evaluation environment",
        description="Check if RAGAS dependencies are installed and configured",
    )
    async def get_environment_status() -> EnvironmentStatus:
        """Check evaluation environment configuration."""
        from lightrag.evaluation.evaluation_manager import (
            get_environment_status as get_env_status,
        )

        status = get_env_status()
        return EnvironmentStatus(**status)

    @router.post(
        "/run",
        dependencies=[Depends(combined_auth)],
        response_model=RunEvaluationResponse,
        summary="Run RAGAS evaluation",
        description="Start a new RAGAS evaluation with provided, selected, or sample test cases",
    )
    async def run_evaluation(
        request: RunEvaluationRequest,
        background_tasks: BackgroundTasks,
    ) -> RunEvaluationResponse:
        """Start a new RAGAS evaluation."""
        from lightrag.evaluation.evaluation_manager import (
            check_ragas_available,
            generate_eval_id,
            get_dataset,
            get_sample_dataset,
            is_evaluation_running,
            run_evaluation_background,
        )

        # Check if RAGAS is available
        if not check_ragas_available():
            raise HTTPException(
                status_code=503,
                detail="RAGAS not installed. Install with: pip install lightrag-hku[evaluation]",
            )

        # Check if already running
        if is_evaluation_running():
            return RunEvaluationResponse(
                status="busy",
                eval_id=None,
                message="An evaluation is already running. Please wait for it to complete.",
                total_tests=0,
            )

        # Get test cases - priority: provided test_cases > dataset_filename > sample
        test_cases = None
        dataset_name = "custom"

        if request.test_cases:
            # Use directly provided test cases
            test_cases = [tc.model_dump() for tc in request.test_cases]
            dataset_name = "uploaded"
        elif request.dataset_filename:
            # Load from specified dataset file
            test_cases = get_dataset(request.dataset_filename)
            dataset_name = request.dataset_filename
            if not test_cases:
                raise HTTPException(
                    status_code=404,
                    detail=f"Dataset not found: {request.dataset_filename}",
                )
        elif request.use_sample_dataset:
            # Use sample dataset
            test_cases = get_sample_dataset()
            dataset_name = "sample_dataset.json"
            if not test_cases:
                raise HTTPException(
                    status_code=404,
                    detail="Sample dataset not found",
                )
        else:
            # Default to sample dataset
            test_cases = get_sample_dataset()
            dataset_name = "sample_dataset.json"

        if not test_cases:
            raise HTTPException(
                status_code=400,
                detail="No test cases provided",
            )

        # Generate eval ID and start background task
        eval_id = generate_eval_id()
        background_tasks.add_task(
            run_evaluation_background,
            eval_id,
            test_cases,
            rag_api_url,
        )

        logger.info(f"Started evaluation {eval_id} with {len(test_cases)} test cases from {dataset_name}")

        return RunEvaluationResponse(
            status="started",
            eval_id=eval_id,
            message=f"Evaluation started with {len(test_cases)} test cases from {dataset_name}",
            total_tests=len(test_cases),
        )

    @router.get(
        "/running",
        dependencies=[Depends(combined_auth)],
        summary="Get running evaluation",
        description="Get the currently running evaluation if any (for page refresh recovery)",
    )
    async def get_running_evaluation():
        """Get the currently running evaluation for page refresh recovery."""
        from lightrag.evaluation.evaluation_manager import (
            get_running_evaluation as get_running,
        )

        running = get_running()
        if running is None:
            return {"running": False, "eval_id": None, "status": None}

        eval_id, status = running
        return {
            "running": True,
            "eval_id": eval_id,
            "status": EvaluationStatus(**status),
        }

    @router.get(
        "/status/{eval_id}",
        dependencies=[Depends(combined_auth)],
        response_model=EvaluationStatus,
        summary="Get evaluation status",
        description="Get the status of a running or completed evaluation",
    )
    async def get_evaluation_status(eval_id: str) -> EvaluationStatus:
        """Get status of a specific evaluation."""
        from lightrag.evaluation.evaluation_manager import (
            get_evaluation_status as get_status,
        )

        status = get_status(eval_id)
        if status is None:
            raise HTTPException(
                status_code=404,
                detail=f"Evaluation {eval_id} not found",
            )

        return EvaluationStatus(**status)

    @router.get(
        "/results",
        dependencies=[Depends(combined_auth)],
        response_model=ResultsListResponse,
        summary="List evaluation results",
        description="List all past evaluation result files",
    )
    async def list_results() -> ResultsListResponse:
        """List all evaluation result files."""
        from lightrag.evaluation.evaluation_manager import list_result_files

        results = list_result_files()
        return ResultsListResponse(
            results=[ResultFileSummary(**r) for r in results],
            total_count=len(results),
        )

    @router.get(
        "/results/{filename}",
        dependencies=[Depends(combined_auth)],
        summary="Get evaluation result",
        description="Get detailed results from a specific evaluation",
    )
    async def get_result(filename: str):
        """Get a specific evaluation result."""
        from lightrag.evaluation.evaluation_manager import get_result_file

        # Validate filename format
        if not filename.startswith("results_") or not filename.endswith(".json"):
            raise HTTPException(
                status_code=400,
                detail="Invalid filename format",
            )

        result = get_result_file(filename)
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Result file {filename} not found",
            )

        return result

    @router.delete(
        "/results/{filename}",
        dependencies=[Depends(combined_auth)],
        response_model=DeleteResultResponse,
        summary="Delete evaluation result",
        description="Delete a specific evaluation result file",
    )
    async def delete_result(filename: str) -> DeleteResultResponse:
        """Delete a specific evaluation result."""
        from lightrag.evaluation.evaluation_manager import delete_result_file

        # Validate filename format
        if not filename.startswith("results_") or not filename.endswith(".json"):
            raise HTTPException(
                status_code=400,
                detail="Invalid filename format",
            )

        success = delete_result_file(filename)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Result file {filename} not found or could not be deleted",
            )

        return DeleteResultResponse(
            status="success",
            message=f"Deleted {filename}",
        )

    @router.get(
        "/sample-dataset",
        dependencies=[Depends(combined_auth)],
        summary="Get sample dataset",
        description="Get the built-in sample dataset for testing",
    )
    async def get_sample_dataset_endpoint():
        """Get the sample evaluation dataset."""
        from lightrag.evaluation.evaluation_manager import get_sample_dataset

        test_cases = get_sample_dataset()
        return {
            "test_cases": test_cases,
            "total_count": len(test_cases),
        }

    @router.get(
        "/datasets",
        dependencies=[Depends(combined_auth)],
        response_model=DatasetsListResponse,
        summary="List available datasets",
        description="List all available evaluation datasets from the datasets folder",
    )
    async def list_datasets() -> DatasetsListResponse:
        """List all available evaluation datasets."""
        from lightrag.evaluation.evaluation_manager import list_available_datasets

        datasets = list_available_datasets()
        return DatasetsListResponse(
            datasets=[DatasetInfo(**d) for d in datasets],
            total_count=len(datasets),
        )

    @router.get(
        "/datasets/{filename:path}",
        dependencies=[Depends(combined_auth)],
        summary="Get dataset contents",
        description="Get the test cases from a specific dataset",
    )
    async def get_dataset_endpoint(filename: str):
        """Get contents of a specific dataset."""
        from lightrag.evaluation.evaluation_manager import get_dataset

        test_cases = get_dataset(filename)
        if not test_cases:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset {filename} not found or empty",
            )

        return {
            "filename": filename,
            "test_cases": test_cases,
            "total_count": len(test_cases),
        }

    return router
