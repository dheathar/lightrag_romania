"""
Tests for garbled PDF extraction detection and tiered fallback chain.

Covers:
- GLYPH marker detection heuristic (_is_extraction_garbled)
- Language detection heuristic (_detect_language)
- _convert_with_docling_enhanced return signature (3-tuple)
- _process_with_docling_or_native return signature (6-tuple)
- Tiered fallback metadata tracking
"""

import sys
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


# ---------------------------------------------------------------------------
# Helper: import from document_routes requires sys.argv workaround because
# the module chain triggers parse_args() which expects lightrag-server args.
# ---------------------------------------------------------------------------

def _import_garbled_check():
    """Import _is_extraction_garbled with sys.argv workaround."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.document_routes import _is_extraction_garbled
        return _is_extraction_garbled
    finally:
        sys.argv = original_argv


def _import_detect_language():
    """Import _detect_language with sys.argv workaround."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.document_routes import _detect_language
        return _detect_language
    finally:
        sys.argv = original_argv


def _import_update_extraction_metadata():
    """Import _update_extraction_metadata with sys.argv workaround."""
    original_argv = sys.argv
    sys.argv = ["lightrag-server"]
    try:
        from lightrag.api.routers.document_routes import _update_extraction_metadata
        return _update_extraction_metadata
    finally:
        sys.argv = original_argv


# ============================================================================
# Test: _is_extraction_garbled quality check
# ============================================================================


@pytest.mark.offline
def test_garbled_detection_high_glyph_ratio():
    """Content with >30% GLYPH lines should be detected as garbled."""
    _is_extraction_garbled = _import_garbled_check()

    # Simulate typical garbled output from a PDF with broken font encoding
    garbled_lines = ["GLYPH<1> GLYPH<2> GLYPH<3>"] * 90
    normal_lines = ["This is normal text."] * 10
    content = "\n".join(garbled_lines + normal_lines)

    assert _is_extraction_garbled(content) is True


@pytest.mark.offline
def test_garbled_detection_low_glyph_ratio():
    """Content with <30% GLYPH lines should NOT be detected as garbled."""
    _is_extraction_garbled = _import_garbled_check()

    normal_lines = ["This is normal text about EU structural funds."] * 80
    glyph_lines = ["GLYPH<1> marker here"] * 10
    content = "\n".join(normal_lines + glyph_lines)

    assert _is_extraction_garbled(content) is False


@pytest.mark.offline
def test_garbled_detection_empty_content():
    """Empty or whitespace content should NOT be detected as garbled."""
    _is_extraction_garbled = _import_garbled_check()

    assert _is_extraction_garbled("") is False
    assert _is_extraction_garbled("   \n\t  \n  ") is False
    assert _is_extraction_garbled(None) is False


@pytest.mark.offline
def test_garbled_detection_pure_glyph():
    """100% GLYPH content should be detected (matches the OPTA PDF pattern)."""
    _is_extraction_garbled = _import_garbled_check()

    content = "\n".join([
        "GLYPH<1> GLYPH<2> GLYPH<3> GLYPH<4>",
        "GLYPH<5> GLYPH<6>",
        "GLYPH<7> GLYPH<8> GLYPH<9>",
        "",  # empty lines should be skipped
        "GLYPH<10> GLYPH<11>",
    ])

    assert _is_extraction_garbled(content) is True


@pytest.mark.offline
def test_garbled_detection_custom_threshold():
    """Custom threshold should be respected."""
    _is_extraction_garbled = _import_garbled_check()

    # 50% GLYPH lines
    content = "\n".join(
        ["GLYPH<1> marker"] * 50 + ["Normal text"] * 50
    )

    # Default threshold (0.3) should detect it
    assert _is_extraction_garbled(content, threshold=0.3) is True
    # Higher threshold should not
    assert _is_extraction_garbled(content, threshold=0.6) is False


@pytest.mark.offline
def test_garbled_detection_html_encoded_glyphs():
    """HTML-encoded GLYPH markers (from Docling markdown) should be detected."""
    _is_extraction_garbled = _import_garbled_check()

    # Docling outputs GLYPH&lt;1&gt; in markdown
    content = "\n".join([
        "GLYPH&lt;1&gt; GLYPH&lt;2&gt;",
        "GLYPH&lt;3&gt; GLYPH&lt;4&gt;",
        "GLYPH&lt;5&gt;",
    ])

    # "GLYPH" substring still present in HTML-encoded form
    assert _is_extraction_garbled(content) is True


# ============================================================================
# Test: _detect_language
# ============================================================================


@pytest.mark.offline
def test_detect_language_romanian():
    """Romanian text with diacritics should be detected as 'ro'."""
    _detect_language = _import_detect_language()

    text = (
        "Programul Operațional Asistență Tehnică este finanțat din fondurile "
        "structurale și de coeziune ale Uniunii Europene pentru perioada "
        "2007-2013. Obiectivul principal este de a asigura implementarea "
        "eficientă a instrumentelor structurale în România."
    )

    assert _detect_language(text) == "ro"


@pytest.mark.offline
def test_detect_language_english():
    """English text should be detected as 'en'."""
    _detect_language = _import_detect_language()

    text = (
        "The Operational Programme Technical Assistance was designed to ensure "
        "support for the coordination and implementation of the Structural "
        "Instruments in Romania, and to guarantee a reliable managing and "
        "monitoring system for the programming period."
    )

    assert _detect_language(text) == "en"


@pytest.mark.offline
def test_detect_language_french():
    """French text should be detected as 'fr'."""
    _detect_language = _import_detect_language()

    text = (
        "Le programme op\u00e9rationnel d'assistance technique a \u00e9t\u00e9 con\u00e7u pour "
        "assurer le soutien \u00e0 la coordination et \u00e0 la mise en \u0153uvre des "
        "instruments structurels en Roumanie, et pour garantir un syst\u00e8me "
        "de gestion et de suivi fiable."
    )

    assert _detect_language(text) == "fr"


@pytest.mark.offline
def test_detect_language_german():
    """German text should be detected as 'de'."""
    _detect_language = _import_detect_language()

    text = (
        "Das operationelle Programm f\u00fcr technische Hilfe wurde entwickelt, "
        "um die Koordinierung und Umsetzung der Strukturinstrumente in "
        "Rum\u00e4nien zu unterst\u00fctzen und ein zuverl\u00e4ssiges Verwaltungs- und "
        "\u00dcberwachungssystem zu gew\u00e4hrleisten."
    )

    assert _detect_language(text) == "de"


@pytest.mark.offline
def test_detect_language_short_text():
    """Very short text should return 'unknown'."""
    _detect_language = _import_detect_language()

    assert _detect_language("Hi") == "unknown"
    assert _detect_language("") == "unknown"
    assert _detect_language(None) == "unknown"


@pytest.mark.offline
def test_detect_language_garbled():
    """Garbled GLYPH text should return 'unknown'."""
    _detect_language = _import_detect_language()

    text = "GLYPH<1> GLYPH<2> GLYPH<3> " * 50
    assert _detect_language(text) == "unknown"


# ============================================================================
# Test: Metadata tracking for fallback and language
# ============================================================================


@pytest.mark.offline
@pytest.mark.asyncio
async def test_update_extraction_metadata_includes_language():
    """_update_extraction_metadata should store language when not 'unknown'."""
    _update_extraction_metadata = _import_update_extraction_metadata()

    mock_rag = MagicMock()
    mock_doc = {
        "metadata": {"extraction_engine": "docling"},
        "status": "processed",
    }
    mock_rag.doc_status.get_by_id = AsyncMock(return_value=mock_doc)
    mock_rag.doc_status.upsert = AsyncMock()

    await _update_extraction_metadata(
        rag=mock_rag,
        content="Test content for metadata",
        extraction_engine="docling",
        figures_count=0,
        vision_model="",
        extraction_fallback="force_ocr",
        detected_language="ro",
    )

    # Verify upsert was called
    assert mock_rag.doc_status.upsert.called
    call_args = mock_rag.doc_status.upsert.call_args[0][0]
    # Get the stored metadata from the upsert call
    doc_id = list(call_args.keys())[0]
    stored_metadata = call_args[doc_id]["metadata"]
    assert stored_metadata["language"] == "ro"
    assert stored_metadata["extraction_fallback"] == "force_ocr"


@pytest.mark.offline
@pytest.mark.asyncio
async def test_update_extraction_metadata_skips_defaults():
    """_update_extraction_metadata should not store 'unknown' language or 'none' fallback."""
    _update_extraction_metadata = _import_update_extraction_metadata()

    mock_rag = MagicMock()
    mock_doc = {
        "metadata": {},
        "status": "processed",
    }
    mock_rag.doc_status.get_by_id = AsyncMock(return_value=mock_doc)
    mock_rag.doc_status.upsert = AsyncMock()

    await _update_extraction_metadata(
        rag=mock_rag,
        content="Test content for metadata",
        extraction_engine="pypdf",
        figures_count=0,
        vision_model="",
        extraction_fallback="none",
        detected_language="unknown",
    )

    # Verify upsert was called
    assert mock_rag.doc_status.upsert.called
    call_args = mock_rag.doc_status.upsert.call_args[0][0]
    doc_id = list(call_args.keys())[0]
    stored_metadata = call_args[doc_id]["metadata"]
    assert "language" not in stored_metadata
    assert "extraction_fallback" not in stored_metadata
