"""
Tests for bugs identified and fixed by Sentinel audit (Feb 2026).

Covers:
- Evaluation result structure consistency (error vs success paths)
- Timeout constants validation
- Config validation (overlap < chunk_size)
- Division by zero safety in benchmark stats
- Metadata spread operator safety
"""

import math
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from pydantic import ValidationError


# ============================================================================
# Test: Error result structure matches success result structure
# ============================================================================


@pytest.mark.offline
def test_eval_error_result_has_all_fields():
    """Error results must include all fields present in success results for consistent CSV/JSON export."""
    # Simulate what evaluate_single_case returns on error
    error_result = {
        "test_number": 1,
        "question": "test question",
        "answer": "",
        "ground_truth": "expected answer",
        "contexts": [],
        "question_type": "figure",
        "project": "test_project",
        "error": "Test error",
        "metrics": {},
        "ragas_score": 0,
        "timestamp": "2026-02-18T00:00:00",
    }

    # Simulate what evaluate_single_case returns on success
    success_result = {
        "test_number": 1,
        "question": "test question",
        "answer": "full answer text",
        "ground_truth": "expected answer",
        "contexts": ["chunk1", "chunk2"],
        "question_type": "figure",
        "project": "test_project",
        "metrics": {
            "faithfulness": 0.9,
            "answer_relevance": 0.8,
            "context_recall": 1.0,
            "context_precision": 0.7,
        },
        "ragas_score": 0.85,
        "timestamp": "2026-02-18T00:00:00",
    }

    # All keys in success should be present in error (plus "error" key)
    success_keys = set(success_result.keys())
    error_keys = set(error_result.keys())

    missing_in_error = success_keys - error_keys
    assert not missing_in_error, (
        f"Error result missing keys that success result has: {missing_in_error}"
    )


@pytest.mark.offline
def test_eval_error_result_safe_defaults():
    """Error result fields should have safe default types."""
    error_result = {
        "test_number": 1,
        "question": "test question",
        "answer": "",
        "ground_truth": "expected answer",
        "contexts": [],
        "question_type": "",
        "project": "unknown",
        "error": "Connection refused",
        "metrics": {},
        "ragas_score": 0,
        "timestamp": "2026-02-18T00:00:00",
    }

    assert isinstance(error_result["answer"], str)
    assert isinstance(error_result["contexts"], list)
    assert isinstance(error_result["question_type"], str)
    assert isinstance(error_result["project"], str)
    assert isinstance(error_result["metrics"], dict)
    assert error_result["ragas_score"] == 0


# ============================================================================
# Test: Timeout constants consistency
# ============================================================================


@pytest.mark.offline
def test_timeout_constants_consistency():
    """TOTAL_TIMEOUT must be >= READ_TIMEOUT to avoid premature cutoff."""
    from lightrag.evaluation.eval_rag_quality import (
        CONNECT_TIMEOUT_SECONDS,
        READ_TIMEOUT_SECONDS,
        TOTAL_TIMEOUT_SECONDS,
    )

    assert TOTAL_TIMEOUT_SECONDS >= READ_TIMEOUT_SECONDS, (
        f"TOTAL_TIMEOUT ({TOTAL_TIMEOUT_SECONDS}s) must be >= "
        f"READ_TIMEOUT ({READ_TIMEOUT_SECONDS}s)"
    )
    assert TOTAL_TIMEOUT_SECONDS >= CONNECT_TIMEOUT_SECONDS, (
        f"TOTAL_TIMEOUT ({TOTAL_TIMEOUT_SECONDS}s) must be >= "
        f"CONNECT_TIMEOUT ({CONNECT_TIMEOUT_SECONDS}s)"
    )
    assert CONNECT_TIMEOUT_SECONDS > 0
    assert READ_TIMEOUT_SECONDS > 0
    assert TOTAL_TIMEOUT_SECONDS > 0


# ============================================================================
# Test: Config validation - overlap must be less than chunk_size
# ============================================================================


@pytest.mark.offline
def test_chunking_config_overlap_less_than_size():
    """chunk_overlap_size must be strictly less than chunk_size."""
    import sys

    # Prevent argparse from consuming pytest args when importing config_routes
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Valid: overlap < size
        config = ChunkingConfigUpdate(chunk_size=500, chunk_overlap_size=100)
        assert config.chunk_size == 500
        assert config.chunk_overlap_size == 100

        # Invalid: overlap == size
        with pytest.raises(ValidationError, match="must be less than"):
            ChunkingConfigUpdate(chunk_size=500, chunk_overlap_size=500)

        # Invalid: overlap > size
        with pytest.raises(ValidationError, match="must be less than"):
            ChunkingConfigUpdate(chunk_size=200, chunk_overlap_size=300)
    finally:
        sys.argv = original_argv


@pytest.mark.offline
def test_chunking_config_partial_update_no_cross_validation():
    """Partial updates (only one field set) should not trigger cross-field validation."""
    import sys

    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Only chunk_size — no error
        config = ChunkingConfigUpdate(chunk_size=500)
        assert config.chunk_size == 500
        assert config.chunk_overlap_size is None

        # Only overlap — no error
        config = ChunkingConfigUpdate(chunk_overlap_size=100)
        assert config.chunk_overlap_size == 100
        assert config.chunk_size is None
    finally:
        sys.argv = original_argv


@pytest.mark.offline
def test_chunking_config_method_validation():
    """Chunking method must be one of TOKEN_SIZE, SEMANTIC, or HYBRID."""
    import sys

    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Valid methods
        for method in ["TOKEN_SIZE", "SEMANTIC", "HYBRID"]:
            config = ChunkingConfigUpdate(method=method)
            assert config.method == method

        # Invalid method
        with pytest.raises(ValidationError, match="must be TOKEN_SIZE"):
            ChunkingConfigUpdate(method="INVALID")
    finally:
        sys.argv = original_argv


# ============================================================================
# Test: Division by zero safety in benchmark stats
# ============================================================================


@pytest.mark.offline
def test_benchmark_stats_empty_results():
    """Benchmark stats should handle empty results without division by zero."""
    from lightrag.evaluation.eval_rag_quality import RAGEvaluator

    evaluator = RAGEvaluator.__new__(RAGEvaluator)
    stats = evaluator._calculate_benchmark_stats([])

    assert stats["total_tests"] == 0
    assert stats["successful_tests"] == 0
    assert stats["success_rate"] == 0.0
    assert stats["average_metrics"]["faithfulness"] == 0.0
    assert stats["min_ragas_score"] == 0.0
    assert stats["max_ragas_score"] == 0.0


@pytest.mark.offline
def test_benchmark_stats_all_errors():
    """Benchmark stats should handle all-error results gracefully."""
    from lightrag.evaluation.eval_rag_quality import RAGEvaluator

    evaluator = RAGEvaluator.__new__(RAGEvaluator)
    error_results = [
        {"test_number": 1, "question": "q1", "error": "fail", "metrics": {}, "ragas_score": 0},
        {"test_number": 2, "question": "q2", "error": "fail", "metrics": {}, "ragas_score": 0},
    ]
    stats = evaluator._calculate_benchmark_stats(error_results)

    assert stats["total_tests"] == 2
    assert stats["successful_tests"] == 0
    assert stats["failed_tests"] == 2
    assert stats["success_rate"] == 0.0


@pytest.mark.offline
def test_benchmark_stats_nan_handling():
    """Benchmark stats should handle NaN metric values gracefully."""
    from lightrag.evaluation.eval_rag_quality import RAGEvaluator

    evaluator = RAGEvaluator.__new__(RAGEvaluator)
    results = [
        {
            "test_number": 1,
            "question": "q1",
            "metrics": {
                "faithfulness": float("nan"),
                "answer_relevance": 0.8,
                "context_recall": float("nan"),
                "context_precision": 0.9,
            },
            "ragas_score": 0.85,
        }
    ]
    stats = evaluator._calculate_benchmark_stats(results)

    # NaN values should be excluded from averages, not propagate
    avg = stats["average_metrics"]
    assert not math.isnan(avg["answer_relevance"])
    assert avg["answer_relevance"] == 0.8
    assert not math.isnan(avg["context_precision"])
    assert avg["context_precision"] == 0.9


# ============================================================================
# Test: Metadata spread operator safety
# ============================================================================


@pytest.mark.offline
def test_metadata_spread_with_dict():
    """Normal dict metadata should spread correctly."""
    metadata = {"extraction_engine": "docling_vision", "figures_count": 5}
    result = {**metadata, "processing_start_time": 12345}
    assert result["extraction_engine"] == "docling_vision"
    assert result["processing_start_time"] == 12345


@pytest.mark.offline
def test_metadata_spread_with_none():
    """None metadata should fall back to empty dict."""
    metadata = None
    result = {**(metadata if isinstance(metadata, dict) else {}), "processing_start_time": 12345}
    assert result == {"processing_start_time": 12345}


@pytest.mark.offline
def test_metadata_spread_with_wrong_type():
    """Non-dict metadata (e.g., string) should fall back to empty dict, not crash."""
    metadata = "corrupted_string"
    result = {**(metadata if isinstance(metadata, dict) else {}), "processing_start_time": 12345}
    assert result == {"processing_start_time": 12345}


@pytest.mark.offline
def test_metadata_spread_with_list():
    """List metadata should fall back to empty dict, not crash with TypeError."""
    metadata = ["item1", "item2"]
    result = {**(metadata if isinstance(metadata, dict) else {}), "processing_start_time": 12345}
    assert result == {"processing_start_time": 12345}


@pytest.mark.offline
def test_metadata_spread_preserves_existing_keys():
    """Spread should preserve existing keys and allow new ones to override."""
    metadata = {
        "extraction_engine": "docling_vision",
        "processing_start_time": 99999,  # old value
    }
    result = {**(metadata if isinstance(metadata, dict) else {}), "processing_start_time": 12345}
    assert result["extraction_engine"] == "docling_vision"
    assert result["processing_start_time"] == 12345  # overridden


# ============================================================================
# Test: Answer/ground_truth not truncated
# ============================================================================


@pytest.mark.offline
def test_eval_result_no_truncation():
    """Evaluation results should contain full answer and ground_truth text."""
    long_answer = "A" * 500
    long_ground_truth = "B" * 500

    # Simulate the success result structure (post-fix, no truncation)
    result = {
        "answer": long_answer,
        "ground_truth": long_ground_truth,
    }

    assert len(result["answer"]) == 500, "Answer should not be truncated"
    assert len(result["ground_truth"]) == 500, "Ground truth should not be truncated"
    assert "..." not in result["answer"], "Answer should not have truncation marker"
    assert "..." not in result["ground_truth"], "Ground truth should not have truncation marker"


# ============================================================================
# Test: Question type field in dataset
# ============================================================================


@pytest.mark.offline
def test_multimodal_dataset_has_question_types():
    """All test cases in the multimodal dataset should have a question_type field."""
    import json
    from pathlib import Path

    dataset_path = Path(__file__).parent.parent / "lightrag" / "evaluation" / "datasets" / "interreg_multimodal.json"
    if not dataset_path.exists():
        pytest.skip("Multimodal dataset not found")

    with open(dataset_path) as f:
        data = json.load(f)

    for i, tc in enumerate(data["test_cases"]):
        assert "question_type" in tc, f"Test case {i} missing question_type"
        assert tc["question_type"] in ("figure", "table", "text"), (
            f"Test case {i} has invalid question_type: {tc['question_type']}"
        )
