"""
Tests for bugs identified by Sentinel audit round 3 (Feb 2026).

Covers:
- JsonDocStatusStorage.get_by_id returns mutable reference (data corruption)
- JsonDocStatusStorage.get_by_id missing StorageNotInitializedError check
- JsonDocStatusStorage.get_doc_by_file_path returns mutable reference
- JsonDocStatusStorage.get_docs_paginated uses shallow copy
- JsonDocStatusStorage.get_docs_by_status missing lock check
- JsonDocStatusStorage.delete missing lock check
- Pagination edge cases (extreme page numbers, negative pages)
"""

import asyncio
import copy
import os
import pytest
import tempfile
import shutil

from lightrag.base import DocStatus
from lightrag.exceptions import StorageNotInitializedError
from lightrag.kg.shared_storage import (
    initialize_share_data,
    finalize_share_data,
)
from lightrag.kg.json_doc_status_impl import JsonDocStatusStorage


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def setup_shared_data():
    """Initialize shared data before each test, finalize after."""
    initialize_share_data()
    yield
    finalize_share_data()


@pytest.fixture
def tmp_dir():
    """Create and cleanup a temporary directory for storage files."""
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def storage(tmp_dir):
    """Create an uninitialized JsonDocStatusStorage instance."""
    s = JsonDocStatusStorage.__new__(JsonDocStatusStorage)
    s.namespace = "doc_status"
    s.workspace = ""
    s.global_config = {"working_dir": tmp_dir}
    s.__post_init__()
    return s


def _make_doc_data(
    status="processed",
    file_path="test.pdf",
    chunks_count=5,
    metadata=None,
):
    """Create a minimal document data dict for testing."""
    return {
        "status": status,
        "chunks_count": chunks_count,
        "chunks_list": [f"chunk-{i}" for i in range(chunks_count)],
        "content_summary": "Test summary content",
        "content_length": 1000,
        "created_at": "2026-02-18T12:00:00+00:00",
        "updated_at": "2026-02-18T12:00:00+00:00",
        "file_path": file_path,
        "track_id": "upload_test_001",
        "metadata": metadata or {"extraction_engine": "docling_vision"},
    }


# ============================================================================
# BUG: get_by_id returns mutable reference to internal cache
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_by_id_returns_copy_not_reference(storage):
    """get_by_id must return a deep copy so callers cannot corrupt internal cache.

    BUG: get_by_id returns self._data.get(id) directly.
    Compare: get_by_ids properly uses copy.deepcopy(data).
    If caller modifies the returned dict, it corrupts the in-memory cache.
    """
    await storage.initialize()

    doc_data = _make_doc_data(file_path="corruption_test.pdf")
    await storage.upsert({"doc-001": doc_data})

    # Retrieve via get_by_id
    result = await storage.get_by_id("doc-001")
    assert result is not None, "Document should exist"

    # Mutate the returned dict
    result["status"] = "CORRUPTED"
    result["metadata"]["extraction_engine"] = "EVIL"

    # Retrieve again - internal cache should NOT be corrupted
    result2 = await storage.get_by_id("doc-001")
    assert result2 is not None

    # BUG DETECTION: If get_by_id returns a reference, these will fail
    assert result2["status"] != "CORRUPTED", (
        "BUG: get_by_id returned mutable reference - internal cache was corrupted! "
        "Expected 'processed', got 'CORRUPTED'"
    )
    assert result2["metadata"]["extraction_engine"] != "EVIL", (
        "BUG: get_by_id returned mutable reference - nested metadata was corrupted! "
        "Expected 'docling_vision', got 'EVIL'"
    )
    assert result2["status"] == "processed"
    assert result2["metadata"]["extraction_engine"] == "docling_vision"


# ============================================================================
# BUG: get_by_id missing StorageNotInitializedError check
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_by_id_raises_when_not_initialized(storage):
    """get_by_id must raise StorageNotInitializedError when storage lock is None.

    BUG: get_by_id does NOT check if self._storage_lock is None,
    unlike every other method (filter_keys, get_by_ids, upsert, is_empty, etc.).
    This causes a confusing TypeError instead of a clear error message.
    """
    # Do NOT call storage.initialize() - lock will be None
    with pytest.raises(
        (StorageNotInitializedError, TypeError, AttributeError)
    ) as exc_info:
        await storage.get_by_id("doc-001")

    # Ideally should be StorageNotInitializedError, not TypeError
    if isinstance(exc_info.value, TypeError):
        pytest.fail(
            "BUG: get_by_id raises TypeError instead of StorageNotInitializedError. "
            "Missing 'if self._storage_lock is None' check."
        )


# ============================================================================
# BUG: get_doc_by_file_path returns mutable reference
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_doc_by_file_path_returns_copy_not_reference(storage):
    """get_doc_by_file_path must return a copy to prevent cache corruption.

    BUG: Returns doc_data directly at line 382 without copy.
    Compare: get_docs_by_status properly uses copy.deepcopy(v).
    """
    await storage.initialize()

    doc_data = _make_doc_data(file_path="filepath_test.pdf")
    await storage.upsert({"doc-002": doc_data})

    # Retrieve by file path
    result = await storage.get_doc_by_file_path("filepath_test.pdf")
    assert result is not None, "Document should be found by file path"

    # Mutate the returned dict
    result["status"] = "CORRUPTED"
    result["chunks_list"].append("injected-chunk")

    # Retrieve again - internal cache should NOT be corrupted
    result2 = await storage.get_doc_by_file_path("filepath_test.pdf")
    assert result2 is not None

    # BUG DETECTION
    assert result2["status"] != "CORRUPTED", (
        "BUG: get_doc_by_file_path returned mutable reference - cache corrupted!"
    )
    assert "injected-chunk" not in result2["chunks_list"], (
        "BUG: get_doc_by_file_path returned mutable reference - chunks_list corrupted!"
    )
    assert result2["status"] == "processed"
    assert result2["chunks_count"] == 5


# ============================================================================
# BUG: get_docs_paginated uses shallow copy instead of deep copy
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_docs_paginated_returns_deep_copy(storage):
    """get_docs_paginated must use deep copy for nested metadata.

    BUG: Uses doc_data.copy() (shallow) at line 279.
    Compare: get_docs_by_status uses copy.deepcopy(v).
    Shallow copy means nested dicts (like metadata) are still references.
    """
    await storage.initialize()

    doc_data = _make_doc_data(
        file_path="paginated_test.pdf",
        metadata={"extraction_engine": "docling_vision", "language": "ro"},
    )
    await storage.upsert({"doc-003": doc_data})

    # Retrieve via paginated
    results, total = await storage.get_docs_paginated(page=1, page_size=50)
    assert total == 1
    assert len(results) == 1

    doc_id, doc_status = results[0]
    assert doc_id == "doc-003"

    # Mutate the metadata of the returned DocProcessingStatus
    if hasattr(doc_status, "metadata") and isinstance(doc_status.metadata, dict):
        doc_status.metadata["extraction_engine"] = "CORRUPTED"

    # Retrieve again - internal cache should NOT be corrupted
    result_check = await storage.get_by_id("doc-003")
    assert result_check is not None

    # BUG DETECTION: shallow copy means nested metadata is still a reference
    if result_check["metadata"]["extraction_engine"] == "CORRUPTED":
        pytest.fail(
            "BUG: get_docs_paginated uses shallow copy - nested metadata was corrupted! "
            "doc_data.copy() must be replaced with copy.deepcopy(doc_data)."
        )


# ============================================================================
# BUG: delete method missing StorageNotInitializedError check
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_delete_raises_when_not_initialized(storage):
    """delete must raise StorageNotInitializedError when not initialized.

    BUG: delete() uses 'async with self._storage_lock' directly
    without checking if self._storage_lock is None first.
    """
    # Do NOT call storage.initialize()
    with pytest.raises(
        (StorageNotInitializedError, TypeError, AttributeError)
    ) as exc_info:
        await storage.delete(["doc-001"])

    if isinstance(exc_info.value, TypeError):
        pytest.fail(
            "BUG: delete() raises TypeError instead of StorageNotInitializedError. "
            "Missing 'if self._storage_lock is None' check."
        )


# ============================================================================
# BUG: get_docs_by_status missing StorageNotInitializedError check
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_docs_by_status_raises_when_not_initialized(storage):
    """get_docs_by_status must raise StorageNotInitializedError when not initialized.

    BUG: get_docs_by_status() uses 'async with self._storage_lock'
    without checking if self._storage_lock is None first.
    """
    # Do NOT call storage.initialize()
    with pytest.raises(
        (StorageNotInitializedError, TypeError, AttributeError)
    ) as exc_info:
        await storage.get_docs_by_status(DocStatus.PROCESSED)

    if isinstance(exc_info.value, TypeError):
        pytest.fail(
            "BUG: get_docs_by_status() raises TypeError instead of "
            "StorageNotInitializedError. Missing lock check."
        )


# ============================================================================
# BUG: get_docs_by_track_id missing StorageNotInitializedError check
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_docs_by_track_id_raises_when_not_initialized(storage):
    """get_docs_by_track_id must raise StorageNotInitializedError when not initialized."""
    # Do NOT call storage.initialize()
    with pytest.raises(
        (StorageNotInitializedError, TypeError, AttributeError)
    ) as exc_info:
        await storage.get_docs_by_track_id("some_track_id")

    if isinstance(exc_info.value, TypeError):
        pytest.fail(
            "BUG: get_docs_by_track_id() raises TypeError instead of "
            "StorageNotInitializedError. Missing lock check."
        )


# ============================================================================
# Pagination edge cases
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_pagination_with_extreme_page_number(storage):
    """Extreme page numbers should return empty results, not crash."""
    await storage.initialize()

    for i in range(5):
        await storage.upsert(
            {f"doc-{i:03d}": _make_doc_data(file_path=f"test_{i}.pdf")}
        )

    # Request extreme page number - should return empty, not crash
    results, total = await storage.get_docs_paginated(page=999999999, page_size=50)
    assert total == 5, "Total count should still reflect all documents"
    assert len(results) == 0, "Extreme page should return empty results"


@pytest.mark.offline
@pytest.mark.asyncio
async def test_pagination_with_negative_page(storage):
    """Negative page number should be corrected to page 1."""
    await storage.initialize()

    await storage.upsert({"doc-001": _make_doc_data(file_path="neg_page.pdf")})

    results, total = await storage.get_docs_paginated(page=-5, page_size=50)
    assert total == 1
    assert len(results) == 1, "Negative page should be corrected to page 1"


# ============================================================================
# Consistency: get_by_id vs get_by_ids behavior
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_by_id_vs_get_by_ids_consistency(storage):
    """get_by_id and get_by_ids should both return isolated deep copies.

    get_by_ids properly deep-copies. get_by_id should do the same.
    """
    await storage.initialize()

    doc_data = _make_doc_data(
        file_path="consistency_test.pdf",
        metadata={"extraction_engine": "docling_vision", "language": "ro"},
    )
    await storage.upsert({"doc-consistency": doc_data})

    # Get via single id
    result_single = await storage.get_by_id("doc-consistency")
    # Get via batch
    result_batch = await storage.get_by_ids(["doc-consistency"])

    assert result_single is not None
    assert len(result_batch) == 1
    assert result_batch[0] is not None

    # Both should have same data
    assert result_single["status"] == result_batch[0]["status"]
    assert result_single["file_path"] == result_batch[0]["file_path"]

    # Mutate both returned objects
    result_single["status"] = "MODIFIED_SINGLE"
    result_batch[0]["status"] = "MODIFIED_BATCH"

    # Original data should be untouched
    final_check = await storage.get_by_ids(["doc-consistency"])
    assert final_check[0]["status"] == "processed", (
        "Internal cache was corrupted by mutations to returned data"
    )


# ============================================================================
# Verify upsert deep-copies input data
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_upsert_deep_copies_input(storage):
    """upsert must deep-copy input data so caller mutations don't affect storage."""
    await storage.initialize()

    doc_data = _make_doc_data(file_path="upsert_copy_test.pdf")
    await storage.upsert({"doc-upsert": doc_data})

    # Mutate the original dict AFTER upsert
    doc_data["status"] = "MUTATED_AFTER_UPSERT"
    doc_data["metadata"]["extraction_engine"] = "EVIL"

    # Storage should NOT be affected
    result = await storage.get_by_id("doc-upsert")
    assert result is not None
    assert result["status"] == "processed", (
        "Storage was affected by mutation of input data after upsert"
    )


# ============================================================================
# get_by_id returns None for missing docs
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_get_by_id_returns_none_for_missing(storage):
    """get_by_id should return None for non-existent document IDs."""
    await storage.initialize()

    result = await storage.get_by_id("nonexistent-doc-id")
    assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
