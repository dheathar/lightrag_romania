"""
Evaluation Manager for WebUI integration.

Provides a wrapper around RAGEvaluator with progress tracking
and background task management for the evaluation API endpoints.
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from lightrag.utils import logger

# Track running evaluations in memory
_running_evaluations: Dict[str, Dict[str, Any]] = {}


def generate_eval_id() -> str:
    """Generate a unique evaluation ID."""
    import uuid

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    return f"eval_{timestamp}_{unique_id}"


def get_results_directory() -> Path:
    """Get the evaluation results directory path."""
    return Path(__file__).parent / "results"


def _get_pipeline_config() -> Dict[str, Any]:
    """Capture current document processing pipeline configuration.

    Returns:
        Dict with extraction engine, chunking method, and vision settings
    """
    try:
        from lightrag.api.config import get_config

        args = get_config()
        return {
            "extraction_engine": getattr(args, "document_loading_engine", "DEFAULT"),
            "chunking_method": getattr(args, "chunking_method", "TOKEN_SIZE"),
            "chunk_size": getattr(args, "chunk_size", 1200),
            "chunk_overlap_size": getattr(args, "chunk_overlap_size", 100),
            "vision_enabled": getattr(args, "vision_enabled", False),
            "vision_model": getattr(args, "vision_model", ""),
        }
    except Exception as e:
        logger.warning(f"Could not capture pipeline config: {e}")
        return {}


def list_result_files() -> List[Dict[str, Any]]:
    """List all evaluation result files with metadata.

    Returns:
        List of dicts with filename, timestamp, test_count, avg_score, and pipeline_config
    """
    results_dir = get_results_directory()
    if not results_dir.exists():
        return []

    result_files = []
    for json_file in sorted(results_dir.glob("results_*.json"), reverse=True):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            result_files.append(
                {
                    "filename": json_file.name,
                    "timestamp": data.get("timestamp", ""),
                    "total_tests": data.get("total_tests", 0),
                    "elapsed_time": data.get("elapsed_time_seconds", 0),
                    "avg_ragas_score": data.get("benchmark_stats", {})
                    .get("average_metrics", {})
                    .get("ragas_score", 0),
                    "success_rate": data.get("benchmark_stats", {}).get(
                        "success_rate", 0
                    ),
                    "pipeline_config": data.get("pipeline_config", None),
                }
            )
        except Exception as e:
            logger.warning(f"Failed to read result file {json_file}: {e}")
            continue

    return result_files


def get_result_file(filename: str) -> Optional[Dict[str, Any]]:
    """Get a specific evaluation result by filename.

    Args:
        filename: Name of the result file (e.g., results_20250120_143200.json)

    Returns:
        Evaluation result dict or None if not found
    """
    results_dir = get_results_directory()
    file_path = results_dir / filename

    # Security: Ensure filename doesn't escape results directory
    if not file_path.resolve().parent == results_dir.resolve():
        logger.warning(f"Attempted path traversal with filename: {filename}")
        return None

    if not file_path.exists():
        return None

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read result file {filename}: {e}")
        return None


def delete_result_file(filename: str) -> bool:
    """Delete a specific evaluation result file.

    Args:
        filename: Name of the result file to delete

    Returns:
        True if deleted successfully, False otherwise
    """
    results_dir = get_results_directory()
    file_path = results_dir / filename

    # Security: Ensure filename doesn't escape results directory
    if not file_path.resolve().parent == results_dir.resolve():
        logger.warning(f"Attempted path traversal with filename: {filename}")
        return False

    if not file_path.exists():
        return False

    try:
        file_path.unlink()
        # Also try to delete corresponding CSV if it exists
        csv_path = file_path.with_suffix(".csv")
        if csv_path.exists():
            csv_path.unlink()
        logger.info(f"Deleted evaluation result: {filename}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete result file {filename}: {e}")
        return False


def get_evaluation_status(eval_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a running or completed evaluation.

    Args:
        eval_id: The evaluation ID

    Returns:
        Status dict with progress info, or None if not found
    """
    return _running_evaluations.get(eval_id)


def is_evaluation_running() -> bool:
    """Check if any evaluation is currently running."""
    for eval_data in _running_evaluations.values():
        if eval_data.get("status") == "running":
            return True
    return False


def get_running_evaluation() -> Optional[Tuple[str, Dict[str, Any]]]:
    """Get the currently running evaluation if any.

    Returns:
        Tuple of (eval_id, status_dict) if an evaluation is running, None otherwise
    """
    for eval_id, eval_data in _running_evaluations.items():
        if eval_data.get("status") == "running":
            return (eval_id, eval_data)
    return None


async def run_evaluation_background(
    eval_id: str,
    test_cases: List[Dict[str, str]],
    rag_api_url: str,
) -> None:
    """Run evaluation in background and update status.

    Args:
        eval_id: Unique evaluation ID for tracking
        test_cases: List of test cases with question and ground_truth
        rag_api_url: URL of the LightRAG API endpoint
    """
    from lightrag.evaluation import RAGEvaluator

    # Initialize status
    _running_evaluations[eval_id] = {
        "status": "running",
        "progress": 0,
        "total": len(test_cases),
        "started_at": datetime.now().isoformat(),
        "result_file": None,
        "error": None,
    }

    try:
        # Create temporary dataset file
        results_dir = get_results_directory()
        results_dir.mkdir(exist_ok=True)

        temp_dataset_path = results_dir / f"temp_dataset_{eval_id}.json"
        with open(temp_dataset_path, "w", encoding="utf-8") as f:
            json.dump({"test_cases": test_cases}, f, indent=2)

        # Define progress callback to update _running_evaluations
        def progress_callback(completed: int, total: int) -> None:
            """Update progress in running evaluations tracker."""
            if eval_id in _running_evaluations:
                _running_evaluations[eval_id]["progress"] = completed
                logger.debug(f"Evaluation {eval_id} progress: {completed}/{total}")

        # Create evaluator and run
        evaluator = RAGEvaluator(
            test_dataset_path=str(temp_dataset_path),
            rag_api_url=rag_api_url,
            progress_callback=progress_callback,
        )

        # Run evaluation (this will save results automatically)
        result = await evaluator.run()

        # Find the result file that was created
        # The evaluator saves with timestamp, so get the latest
        latest_files = sorted(results_dir.glob("results_*.json"), reverse=True)
        result_filename = latest_files[0].name if latest_files else None

        # Inject pipeline config into saved result file
        if result_filename:
            pipeline_config = _get_pipeline_config()
            if pipeline_config:
                try:
                    result_path = results_dir / result_filename
                    with open(result_path, "r", encoding="utf-8") as f:
                        result_data = json.load(f)
                    result_data["pipeline_config"] = pipeline_config
                    with open(result_path, "w", encoding="utf-8") as f:
                        json.dump(result_data, f, indent=2)
                    logger.info(f"Saved pipeline config to {result_filename}")
                except Exception as e:
                    logger.warning(f"Failed to save pipeline config: {e}")

        # Update status to completed
        _running_evaluations[eval_id] = {
            "status": "completed",
            "progress": len(test_cases),
            "total": len(test_cases),
            "started_at": _running_evaluations[eval_id]["started_at"],
            "completed_at": datetime.now().isoformat(),
            "result_file": result_filename,
            "elapsed_time": result.get("elapsed_time_seconds", 0),
            "avg_ragas_score": result.get("benchmark_stats", {})
            .get("average_metrics", {})
            .get("ragas_score", 0),
            "error": None,
        }

        # Cleanup temp dataset file
        if temp_dataset_path.exists():
            temp_dataset_path.unlink()

        logger.info(f"Evaluation {eval_id} completed successfully")

    except Exception as e:
        logger.error(f"Evaluation {eval_id} failed: {e}")
        _running_evaluations[eval_id] = {
            "status": "failed",
            "progress": _running_evaluations[eval_id].get("progress", 0),
            "total": len(test_cases),
            "started_at": _running_evaluations[eval_id]["started_at"],
            "completed_at": datetime.now().isoformat(),
            "result_file": None,
            "error": str(e),
        }


def get_sample_dataset() -> List[Dict[str, str]]:
    """Load the sample dataset for testing.

    Returns:
        List of test cases from sample_dataset.json
    """
    sample_path = Path(__file__).parent / "sample_dataset.json"
    if not sample_path.exists():
        return []

    try:
        with open(sample_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("test_cases", [])
    except Exception as e:
        logger.error(f"Failed to load sample dataset: {e}")
        return []


def check_ragas_available() -> bool:
    """Check if RAGAS dependencies are installed.

    Returns:
        True if RAGAS is available, False otherwise
    """
    try:
        from lightrag.evaluation import RAGEvaluator

        return True
    except ImportError:
        return False


def get_environment_status() -> Dict[str, Any]:
    """Check evaluation environment configuration.

    Returns:
        Dict with environment status info
    """
    return {
        "ragas_available": check_ragas_available(),
        "eval_llm_api_key_set": bool(
            os.getenv("EVAL_LLM_BINDING_API_KEY") or os.getenv("OPENAI_API_KEY")
        ),
        "eval_model": os.getenv("EVAL_LLM_MODEL", "gpt-4o-mini"),
        "eval_embedding_model": os.getenv("EVAL_EMBEDDING_MODEL", "text-embedding-3-large"),
        "lightrag_api_url": os.getenv("LIGHTRAG_API_URL", "http://localhost:9621"),
    }


def get_datasets_directory() -> Path:
    """Get the evaluation datasets directory path."""
    return Path(__file__).parent / "datasets"


def list_available_datasets() -> List[Dict[str, Any]]:
    """List all available evaluation datasets.

    Searches both the main evaluation folder (sample_dataset.json)
    and the datasets/ subfolder for JSON files.

    Returns:
        List of dicts with filename, name, test_count, description, and source_pdf info
    """
    datasets = []

    # Check for sample_dataset.json in main evaluation folder
    sample_path = Path(__file__).parent / "sample_dataset.json"
    if sample_path.exists():
        try:
            with open(sample_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            test_cases = data.get("test_cases", [])
            datasets.append({
                "filename": "sample_dataset.json",
                "name": "Sample Dataset (Default)",
                "test_count": len(test_cases),
                "description": "Built-in sample dataset for testing",
                "is_default": True,
                "source_pdf": None,
                "source_pdf_exists": False,
            })
        except Exception as e:
            logger.warning(f"Failed to read sample_dataset.json: {e}")

    # Check datasets/ subfolder
    datasets_dir = get_datasets_directory()
    source_pdfs_dir = datasets_dir / "source_pdfs"

    if datasets_dir.exists():
        for json_file in sorted(datasets_dir.glob("*.json")):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                test_cases = data.get("test_cases", [])
                dataset_info = data.get("dataset_info", {})

                # Generate friendly name from filename
                name = dataset_info.get("name", json_file.stem.replace("_", " ").title())

                # Check for source PDF
                source_pdf = dataset_info.get("source_document", None)
                source_pdf_exists = False

                if source_pdf and source_pdfs_dir.exists():
                    # Check if the PDF exists in source_pdfs folder
                    pdf_path = source_pdfs_dir / source_pdf
                    source_pdf_exists = pdf_path.exists()

                datasets.append({
                    "filename": f"datasets/{json_file.name}",
                    "name": name,
                    "test_count": len(test_cases),
                    "description": dataset_info.get("description", ""),
                    "is_default": False,
                    "source_pdf": source_pdf,
                    "source_pdf_exists": source_pdf_exists,
                })
            except Exception as e:
                logger.warning(f"Failed to read dataset {json_file}: {e}")
                continue

    return datasets


def get_dataset(filename: str) -> List[Dict[str, str]]:
    """Load a specific dataset by filename.

    Args:
        filename: Dataset filename (e.g., "sample_dataset.json" or "datasets/my_dataset.json")

    Returns:
        List of test cases from the dataset
    """
    eval_dir = Path(__file__).parent

    # Handle both direct files and datasets/ subfolder
    if filename.startswith("datasets/"):
        file_path = eval_dir / filename
    else:
        file_path = eval_dir / filename

    # Security: Ensure path doesn't escape evaluation directory
    try:
        resolved = file_path.resolve()
        eval_resolved = eval_dir.resolve()
        if not str(resolved).startswith(str(eval_resolved)):
            logger.warning(f"Attempted path traversal with filename: {filename}")
            return []
    except Exception:
        return []

    if not file_path.exists():
        logger.warning(f"Dataset not found: {filename}")
        return []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("test_cases", [])
    except Exception as e:
        logger.error(f"Failed to load dataset {filename}: {e}")
        return []
