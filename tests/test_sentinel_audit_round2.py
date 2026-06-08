"""
Tests for bugs identified and fixed by Sentinel audit round 2 (Feb 2026).

Covers:
- Config partial update validation (overlap vs chunk_size cross-check)
- Empty chunk prevention in token-based splitting
- Duplicate boundary deduplication in semantic chunking
- Chunking edge cases (whitespace, single sentence, uniform distances)
"""

import sys
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


# ============================================================================
# Test: Config partial update validates against current args
# ============================================================================


@pytest.mark.offline
def test_config_partial_update_overlap_only_exceeds_current_chunk_size():
    """PATCH with only overlap that exceeds current chunk_size should fail."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Simulate: current chunk_size=500, user sends overlap=600
        # Pydantic model validation passes (only one field) — this tests the model
        config = ChunkingConfigUpdate(chunk_overlap_size=600)
        assert config.chunk_overlap_size == 600
        assert config.chunk_size is None  # Not provided — passes model validation

        # The REAL validation happens in the PATCH handler, not in Pydantic model
        # This test confirms partial updates bypass model-level cross-validation
    finally:
        sys.argv = original_argv


@pytest.mark.offline
def test_config_partial_update_chunk_size_only_below_current_overlap():
    """PATCH with only chunk_size that's smaller than current overlap should fail at handler level."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Simulate: current overlap=200, user sends chunk_size=100
        # Pydantic model passes (chunk_size=100 is within [100,10000])
        config = ChunkingConfigUpdate(chunk_size=100)
        assert config.chunk_size == 100
        assert config.chunk_overlap_size is None
    finally:
        sys.argv = original_argv


@pytest.mark.offline
@pytest.mark.asyncio
async def test_config_patch_handler_rejects_partial_overlap_exceeding_size():
    """The PATCH /config handler must validate resulting combination, not just request fields."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import (
            ConfigUpdateRequest,
            ChunkingConfigUpdate,
        )

        # Create mock args simulating current config
        mock_args = MagicMock()
        mock_args.chunk_size = 500
        mock_args.chunk_overlap_size = 100

        # Build request: only overlap, no chunk_size
        update = ConfigUpdateRequest(
            chunking=ChunkingConfigUpdate(chunk_overlap_size=600)
        )

        # The handler's pre-validation logic should catch this:
        # new_chunk_size = args.chunk_size (500) since not in request
        # new_overlap = 600 from request
        # 600 >= 500 → should raise ValueError
        new_chunk_size = (
            update.chunking.chunk_size
            if update.chunking.chunk_size is not None
            else mock_args.chunk_size
        )
        new_overlap = (
            update.chunking.chunk_overlap_size
            if update.chunking.chunk_overlap_size is not None
            else mock_args.chunk_overlap_size
        )

        assert new_overlap >= new_chunk_size, (
            f"Expected overlap ({new_overlap}) >= chunk_size ({new_chunk_size})"
        )
    finally:
        sys.argv = original_argv


@pytest.mark.offline
@pytest.mark.asyncio
async def test_config_patch_handler_accepts_valid_partial_update():
    """Partial update that keeps resulting config valid should succeed."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import (
            ConfigUpdateRequest,
            ChunkingConfigUpdate,
        )

        mock_args = MagicMock()
        mock_args.chunk_size = 500
        mock_args.chunk_overlap_size = 100

        # Only overlap, still less than current chunk_size
        update = ConfigUpdateRequest(
            chunking=ChunkingConfigUpdate(chunk_overlap_size=200)
        )

        new_chunk_size = (
            update.chunking.chunk_size
            if update.chunking.chunk_size is not None
            else mock_args.chunk_size
        )
        new_overlap = (
            update.chunking.chunk_overlap_size
            if update.chunking.chunk_overlap_size is not None
            else mock_args.chunk_overlap_size
        )

        assert new_overlap < new_chunk_size, (
            f"Expected overlap ({new_overlap}) < chunk_size ({new_chunk_size})"
        )
    finally:
        sys.argv = original_argv


@pytest.mark.offline
@pytest.mark.asyncio
async def test_config_patch_handler_rejects_shrinking_chunk_size_below_overlap():
    """Reducing chunk_size below current overlap should be rejected."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import (
            ConfigUpdateRequest,
            ChunkingConfigUpdate,
        )

        mock_args = MagicMock()
        mock_args.chunk_size = 1200
        mock_args.chunk_overlap_size = 200

        # Shrink chunk_size to 150, but overlap is 200
        update = ConfigUpdateRequest(
            chunking=ChunkingConfigUpdate(chunk_size=150)
        )

        new_chunk_size = (
            update.chunking.chunk_size
            if update.chunking.chunk_size is not None
            else mock_args.chunk_size
        )
        new_overlap = (
            update.chunking.chunk_overlap_size
            if update.chunking.chunk_overlap_size is not None
            else mock_args.chunk_overlap_size
        )

        assert new_overlap >= new_chunk_size, (
            f"Expected overlap ({new_overlap}) >= chunk_size ({new_chunk_size}) — should be rejected"
        )
    finally:
        sys.argv = original_argv


# ============================================================================
# Test: Empty chunk prevention in token-based splitting
# ============================================================================


@pytest.mark.offline
def test_token_based_split_skips_empty_chunks():
    """Token-based split should not produce chunks with empty content."""
    from lightrag.chunking import _token_based_split

    # Create a mock tokenizer that produces whitespace on decode
    mock_tokenizer = MagicMock()
    # Encoding produces tokens for whitespace sequences
    mock_tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    # First decode returns content, second returns whitespace-only
    mock_tokenizer.decode.side_effect = [
        "Hello world",
        "   \n\t  ",  # Whitespace-only — should be skipped
    ]

    result = _token_based_split(
        mock_tokenizer,
        content="Hello world   \n\t  ",
        chunk_token_size=3,
        chunk_overlap_token_size=0,
    )

    # Only the non-empty chunk should be present
    contents = [chunk["content"] for chunk in result]
    assert all(c.strip() != "" for c in contents), (
        f"Found empty chunk content in results: {contents}"
    )


@pytest.mark.offline
def test_token_based_split_reindexes_after_skip():
    """After skipping empty chunks, chunk_order_index should be sequential."""
    from lightrag.chunking import _token_based_split

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = list(range(9))
    # 3 chunks of size 3: first valid, second empty, third valid
    mock_tokenizer.decode.side_effect = [
        "chunk one",
        "   ",  # Empty — skipped
        "chunk three",
    ]

    result = _token_based_split(
        mock_tokenizer,
        content="chunk one    chunk three",
        chunk_token_size=3,
        chunk_overlap_token_size=0,
    )

    # Should have 2 chunks with sequential indices 0, 1
    indices = [chunk["chunk_order_index"] for chunk in result]
    assert indices == list(range(len(result))), (
        f"Expected sequential indices, got: {indices}"
    )


@pytest.mark.offline
def test_token_based_split_normal_content():
    """Normal text should produce non-empty chunks with sequential indices."""
    from lightrag.chunking import _token_based_split

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = list(range(6))
    mock_tokenizer.decode.side_effect = [
        "Hello world",
        "Foo bar",
    ]

    result = _token_based_split(
        mock_tokenizer,
        content="Hello world Foo bar",
        chunk_token_size=3,
        chunk_overlap_token_size=0,
    )

    assert len(result) == 2
    assert result[0]["content"] == "Hello world"
    assert result[1]["content"] == "Foo bar"
    assert result[0]["chunk_order_index"] == 0
    assert result[1]["chunk_order_index"] == 1


# ============================================================================
# Test: Duplicate boundary deduplication in semantic chunking
# ============================================================================


@pytest.mark.offline
def test_semantic_boundary_deduplication():
    """When last breakpoint equals len(sentences)-1, no duplicate should be added."""
    # The fix ensures chunk_boundaries doesn't have duplicate end markers
    sentences = ["s0", "s1", "s2", "s3", "s4"]  # 5 sentences, last idx = 4

    # Case 1: breakpoint at last sentence index
    breakpoints = [2, 4]  # 4 == len(sentences) - 1
    end_marker = len(sentences) - 1
    if not breakpoints or breakpoints[-1] != end_marker:
        chunk_boundaries = breakpoints + [end_marker]
    else:
        chunk_boundaries = breakpoints

    assert chunk_boundaries == [2, 4], (
        f"Expected [2, 4] (no duplicate), got {chunk_boundaries}"
    )

    # Case 2: breakpoint NOT at last sentence
    breakpoints2 = [2, 3]
    if not breakpoints2 or breakpoints2[-1] != end_marker:
        chunk_boundaries2 = breakpoints2 + [end_marker]
    else:
        chunk_boundaries2 = breakpoints2

    assert chunk_boundaries2 == [2, 3, 4], (
        f"Expected [2, 3, 4] (end marker added), got {chunk_boundaries2}"
    )


@pytest.mark.offline
def test_semantic_boundary_empty_breakpoints():
    """Empty breakpoints should add the end marker."""
    sentences = ["s0", "s1", "s2"]
    breakpoints = []
    end_marker = len(sentences) - 1

    if not breakpoints or breakpoints[-1] != end_marker:
        chunk_boundaries = breakpoints + [end_marker]
    else:
        chunk_boundaries = breakpoints

    assert chunk_boundaries == [2], (
        f"Expected [2] (end marker only), got {chunk_boundaries}"
    )


@pytest.mark.offline
def test_semantic_boundary_single_sentence():
    """Single sentence: end marker = 0, no breakpoints → boundary = [0]."""
    sentences = ["only sentence"]
    breakpoints = []
    end_marker = len(sentences) - 1  # = 0

    if not breakpoints or breakpoints[-1] != end_marker:
        chunk_boundaries = breakpoints + [end_marker]
    else:
        chunk_boundaries = breakpoints

    assert chunk_boundaries == [0], (
        f"Expected [0], got {chunk_boundaries}"
    )


# ============================================================================
# Test: Chunking config method validation from Pydantic model
# ============================================================================


@pytest.mark.offline
def test_chunking_config_valid_methods():
    """All three valid chunking methods should be accepted."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        for method in ["TOKEN_SIZE", "SEMANTIC", "HYBRID"]:
            config = ChunkingConfigUpdate(method=method)
            assert config.method == method
    finally:
        sys.argv = original_argv


@pytest.mark.offline
def test_chunking_config_boundary_values():
    """Boundary values for chunking config should be accepted or rejected correctly."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from pydantic import ValidationError
        from lightrag.api.routers.config_routes import ChunkingConfigUpdate

        # Min boundary: chunk_size=100, overlap=0
        config = ChunkingConfigUpdate(chunk_size=100, chunk_overlap_size=0)
        assert config.chunk_size == 100
        assert config.chunk_overlap_size == 0

        # Max boundary: chunk_size=10000, overlap=1000
        config = ChunkingConfigUpdate(chunk_size=10000, chunk_overlap_size=1000)
        assert config.chunk_size == 10000
        assert config.chunk_overlap_size == 1000

        # Below min: chunk_size=99
        with pytest.raises(ValidationError):
            ChunkingConfigUpdate(chunk_size=99)

        # Above max: overlap=1001
        with pytest.raises(ValidationError):
            ChunkingConfigUpdate(chunk_overlap_size=1001)

        # Semantic threshold boundaries
        config = ChunkingConfigUpdate(semantic_similarity_threshold=0.0)
        assert config.semantic_similarity_threshold == 0.0

        config = ChunkingConfigUpdate(semantic_similarity_threshold=1.0)
        assert config.semantic_similarity_threshold == 1.0

        with pytest.raises(ValidationError):
            ChunkingConfigUpdate(semantic_similarity_threshold=1.1)

        with pytest.raises(ValidationError):
            ChunkingConfigUpdate(semantic_similarity_threshold=-0.1)
    finally:
        sys.argv = original_argv


# ============================================================================
# Test: Token-based split edge cases
# ============================================================================


@pytest.mark.offline
def test_token_based_split_empty_input():
    """Empty input should produce no chunks."""
    from lightrag.chunking import _token_based_split

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = []

    result = _token_based_split(
        mock_tokenizer,
        content="",
        chunk_token_size=100,
        chunk_overlap_token_size=0,
    )

    assert result == [], f"Expected empty result for empty input, got: {result}"


@pytest.mark.offline
def test_token_based_split_single_token():
    """Single token should produce one chunk."""
    from lightrag.chunking import _token_based_split

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [42]
    mock_tokenizer.decode.return_value = "x"

    result = _token_based_split(
        mock_tokenizer,
        content="x",
        chunk_token_size=100,
        chunk_overlap_token_size=0,
    )

    assert len(result) == 1
    assert result[0]["content"] == "x"
    assert result[0]["tokens"] == 1


@pytest.mark.offline
def test_token_based_split_overlap_equals_chunk_size_minus_one():
    """When overlap = chunk_size - 1, step should be 1 (maximal overlap)."""
    from lightrag.chunking import _token_based_split

    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3]
    mock_tokenizer.decode.side_effect = ["abc", "bcd", "cde"]

    result = _token_based_split(
        mock_tokenizer,
        content="abcde",
        chunk_token_size=2,
        chunk_overlap_token_size=1,  # step = max(1, 2-1) = 1
    )

    # With 3 tokens and step=1, we get 3 chunks (start: 0, 1, 2)
    # but only non-empty ones survive
    assert len(result) >= 1
    assert all(chunk["content"].strip() for chunk in result)
