"""Chunking strategies for LightRAG document processing.

This module provides multiple chunking methods for splitting documents into
semantically coherent chunks for RAG retrieval:

- TOKEN_SIZE: Fixed-size token-based chunking (default, fastest)
- SEMANTIC: Embedding-based semantic chunking (better coherence, slower)
- HYBRID: Combines token-based with semantic validation
"""
from __future__ import annotations

import re
from enum import Enum
from typing import Any, Callable, Awaitable

import numpy as np

from lightrag.utils import logger, Tokenizer, EmbeddingFunc


class ChunkingMethod(str, Enum):
    """Chunking method selection for document processing."""

    TOKEN_SIZE = "TOKEN_SIZE"
    """Fixed-size token-based chunking (default, fastest)."""

    SEMANTIC = "SEMANTIC"
    """Embedding-based semantic similarity chunking (better coherence)."""

    HYBRID = "HYBRID"
    """Token-based chunking with semantic boundary validation."""


# Sentence splitting regex patterns
# Matches end-of-sentence punctuation followed by whitespace
_SENTENCE_ENDINGS = re.compile(
    r'(?<=[.!?])\s+(?=[A-Z])|'  # Standard sentence end
    r'(?<=[.!?])\s*\n+|'        # Sentence end with newline
    r'\n{2,}'                    # Paragraph breaks
)

# Fallback pattern for aggressive splitting
_SENTENCE_FALLBACK = re.compile(r'[.!?]+\s+')


def _split_into_sentences(content: str) -> list[str]:
    """Split text into sentences using regex patterns.

    Uses multiple strategies to handle various text formats without
    requiring external NLP libraries like NLTK.

    Args:
        content: Text content to split into sentences.

    Returns:
        List of sentence strings, preserving order.
    """
    if not content or not content.strip():
        return []

    # Normalize whitespace
    content = content.strip()

    # Try primary sentence splitting
    sentences = _SENTENCE_ENDINGS.split(content)

    # Filter empty strings and strip whitespace
    sentences = [s.strip() for s in sentences if s and s.strip()]

    # If we got very few sentences, try fallback pattern
    if len(sentences) <= 2 and len(content) > 500:
        sentences = _SENTENCE_FALLBACK.split(content)
        sentences = [s.strip() for s in sentences if s and s.strip()]

    # If still no luck, split by newlines
    if len(sentences) <= 1 and len(content) > 200:
        sentences = content.split('\n')
        sentences = [s.strip() for s in sentences if s and s.strip()]

    # Last resort: return content as single sentence
    if not sentences:
        return [content]

    return sentences


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors.

    Args:
        a: First embedding vector.
        b: Second embedding vector.

    Returns:
        Cosine similarity value between -1 and 1.
    """
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


def _token_based_split(
    tokenizer: Tokenizer,
    content: str,
    chunk_token_size: int,
    chunk_overlap_token_size: int,
) -> list[dict[str, Any]]:
    """Split content by token size with overlap.

    This is the fallback implementation matching chunking_by_token_size behavior.

    Args:
        tokenizer: Tokenizer instance for encoding/decoding.
        content: Text to split.
        chunk_token_size: Maximum tokens per chunk.
        chunk_overlap_token_size: Overlapping tokens between chunks.

    Returns:
        List of chunk dictionaries with tokens, content, chunk_order_index.
    """
    tokens = tokenizer.encode(content)
    results: list[dict[str, Any]] = []

    step = max(1, chunk_token_size - chunk_overlap_token_size)

    for index, start in enumerate(range(0, len(tokens), step)):
        chunk_content = tokenizer.decode(tokens[start : start + chunk_token_size]).strip()
        if not chunk_content:
            continue  # Skip empty chunks from whitespace/control character sequences
        results.append(
            {
                "tokens": min(chunk_token_size, len(tokens) - start),
                "content": chunk_content,
                "chunk_order_index": index,
            }
        )

    # Re-index after skipping empty chunks
    for i, chunk in enumerate(results):
        chunk["chunk_order_index"] = i

    return results


async def chunking_by_semantic_similarity(
    tokenizer: Tokenizer,
    content: str,
    split_by_character: str | None = None,
    split_by_character_only: bool = False,
    chunk_overlap_token_size: int = 100,
    chunk_token_size: int = 1200,
    *,
    embedding_func: EmbeddingFunc | None = None,
    similarity_threshold: float = 0.8,
    min_chunk_tokens: int = 100,
    max_tokens_for_semantic: int = 100000,
) -> list[dict[str, Any]]:
    """Split content into chunks based on semantic similarity.

    Uses embedding-based similarity to detect topic shifts and create
    semantically coherent chunks. Falls back to token-based chunking
    when embedding is unavailable or content is too large.

    Algorithm:
    1. Split content into sentences using regex
    2. Embed all sentences using the provided embedding function
    3. Calculate cosine distances between adjacent sentence embeddings
    4. Find breakpoints where distance exceeds percentile threshold
    5. Merge sentences between breakpoints into chunks
    6. Enforce max_token_size constraint (split if needed)

    Args:
        tokenizer: Tokenizer instance for token counting.
        content: Text content to chunk.
        split_by_character: Ignored for semantic chunking (for API compatibility).
        split_by_character_only: Ignored for semantic chunking (for API compatibility).
        chunk_overlap_token_size: Overlap tokens when splitting oversized chunks.
        chunk_token_size: Maximum tokens per chunk.
        embedding_func: Async embedding function returning numpy arrays.
        similarity_threshold: Percentile threshold for breakpoint detection (0.0-1.0).
            Higher values = fewer, larger chunks. Default 0.8 (80th percentile).
        min_chunk_tokens: Minimum tokens per chunk before merging with neighbor.
        max_tokens_for_semantic: Max content tokens before falling back to token-based.

    Returns:
        List of chunk dictionaries with keys: tokens, content, chunk_order_index.

    Note:
        The split_by_character and split_by_character_only parameters are accepted
        for API compatibility with chunking_by_token_size but are ignored.
    """
    # Validate content
    if not content or not content.strip():
        return []

    content = content.strip()
    total_tokens = len(tokenizer.encode(content))

    # Fallback to token-based for very large documents
    if total_tokens > max_tokens_for_semantic:
        logger.warning(
            f"Document too large for semantic chunking ({total_tokens} tokens > "
            f"{max_tokens_for_semantic}), falling back to token-based"
        )
        return _token_based_split(
            tokenizer, content, chunk_token_size, chunk_overlap_token_size
        )

    # Fallback if no embedding function provided
    if embedding_func is None:
        logger.warning(
            "No embedding function provided for semantic chunking, "
            "falling back to token-based"
        )
        return _token_based_split(
            tokenizer, content, chunk_token_size, chunk_overlap_token_size
        )

    # Split into sentences
    sentences = _split_into_sentences(content)

    # Need at least 3 sentences for meaningful semantic analysis
    if len(sentences) < 3:
        logger.info(
            f"Too few sentences ({len(sentences)}) for semantic chunking, "
            "using token-based"
        )
        return _token_based_split(
            tokenizer, content, chunk_token_size, chunk_overlap_token_size
        )

    # Embed all sentences
    try:
        embeddings = await embedding_func(sentences)

        # Ensure 2D array shape (batch_size, embedding_dim)
        if embeddings.ndim == 1:
            # Single embedding - shouldn't happen with multiple sentences
            return _token_based_split(
                tokenizer, content, chunk_token_size, chunk_overlap_token_size
            )

    except Exception as e:
        logger.warning(f"Embedding failed during semantic chunking: {e}, falling back")
        return _token_based_split(
            tokenizer, content, chunk_token_size, chunk_overlap_token_size
        )

    # Calculate cosine distances between adjacent sentences
    distances: list[float] = []
    for i in range(len(embeddings) - 1):
        similarity = _cosine_similarity(embeddings[i], embeddings[i + 1])
        distance = 1.0 - similarity
        distances.append(distance)

    if not distances:
        return _token_based_split(
            tokenizer, content, chunk_token_size, chunk_overlap_token_size
        )

    # Find breakpoints using percentile threshold
    threshold_value = float(np.percentile(distances, similarity_threshold * 100))
    breakpoints: list[int] = [
        i for i, d in enumerate(distances) if d > threshold_value
    ]

    # Build chunks from sentence groups
    chunks: list[dict[str, Any]] = []
    start_idx = 0

    # Add end marker for final chunk (deduplicate to avoid processing last boundary twice)
    end_marker = len(sentences) - 1
    if not breakpoints or breakpoints[-1] != end_marker:
        chunk_boundaries = breakpoints + [end_marker]
    else:
        chunk_boundaries = breakpoints

    for bp in chunk_boundaries:
        # Merge sentences from start_idx to bp (inclusive)
        chunk_sentences = sentences[start_idx : bp + 1]
        chunk_text = " ".join(chunk_sentences)
        chunk_tokens = len(tokenizer.encode(chunk_text))

        if chunk_tokens > chunk_token_size:
            # Chunk too large - split by tokens
            sub_chunks = _token_based_split(
                tokenizer, chunk_text, chunk_token_size, chunk_overlap_token_size
            )
            for sub in sub_chunks:
                sub["chunk_order_index"] = len(chunks)
                chunks.append(sub)
        elif chunk_tokens >= min_chunk_tokens:
            # Good size - add as chunk
            chunks.append(
                {
                    "tokens": chunk_tokens,
                    "content": chunk_text.strip(),
                    "chunk_order_index": len(chunks),
                }
            )
        else:
            # Chunk too small - merge with previous if exists
            if chunks:
                prev = chunks[-1]
                merged_content = prev["content"] + " " + chunk_text
                merged_tokens = len(tokenizer.encode(merged_content))

                if merged_tokens <= chunk_token_size:
                    prev["content"] = merged_content.strip()
                    prev["tokens"] = merged_tokens
                else:
                    # Can't merge - add as small chunk anyway
                    chunks.append(
                        {
                            "tokens": chunk_tokens,
                            "content": chunk_text.strip(),
                            "chunk_order_index": len(chunks),
                        }
                    )
            else:
                # First chunk is small - add anyway
                chunks.append(
                    {
                        "tokens": chunk_tokens,
                        "content": chunk_text.strip(),
                        "chunk_order_index": len(chunks),
                    }
                )

        start_idx = bp + 1

    # Re-index chunk_order_index to be sequential
    for i, chunk in enumerate(chunks):
        chunk["chunk_order_index"] = i

    logger.info(
        f"Semantic chunking: {len(sentences)} sentences -> {len(chunks)} chunks "
        f"(threshold={similarity_threshold}, breakpoints={len(breakpoints)})"
    )

    return chunks


async def chunking_hybrid(
    tokenizer: Tokenizer,
    content: str,
    split_by_character: str | None = None,
    split_by_character_only: bool = False,
    chunk_overlap_token_size: int = 100,
    chunk_token_size: int = 1200,
    *,
    embedding_func: EmbeddingFunc | None = None,
    similarity_threshold: float = 0.8,
    min_chunk_tokens: int = 100,
    max_tokens_for_semantic: int = 100000,
) -> list[dict[str, Any]]:
    """Hybrid chunking combining token-based with semantic validation.

    First performs token-based chunking, then validates chunk boundaries
    using semantic similarity. Adjusts boundaries to align with topic shifts
    when possible.

    This approach is faster than pure semantic chunking while still
    improving chunk coherence.

    Args:
        tokenizer: Tokenizer instance for token counting.
        content: Text content to chunk.
        split_by_character: Character to split on before token splitting.
        split_by_character_only: If True, only split by character.
        chunk_overlap_token_size: Overlap tokens between chunks.
        chunk_token_size: Maximum tokens per chunk.
        embedding_func: Async embedding function for validation.
        similarity_threshold: Threshold for detecting topic shifts.
        min_chunk_tokens: Minimum tokens per chunk.
        max_tokens_for_semantic: Max tokens before skipping semantic validation.

    Returns:
        List of chunk dictionaries with keys: tokens, content, chunk_order_index.
    """
    # Start with token-based chunking
    chunks = _token_based_split(
        tokenizer, content, chunk_token_size, chunk_overlap_token_size
    )

    # Skip semantic validation if no embedding function or few chunks
    if embedding_func is None or len(chunks) < 2:
        return chunks

    total_tokens = sum(c["tokens"] for c in chunks)
    if total_tokens > max_tokens_for_semantic:
        logger.info(
            f"Skipping semantic validation for large document ({total_tokens} tokens)"
        )
        return chunks

    # Embed chunk contents for coherence validation
    try:
        chunk_texts = [c["content"] for c in chunks]
        embeddings = await embedding_func(chunk_texts)

        # Calculate coherence score for logging
        coherence_scores: list[float] = []
        for i in range(len(embeddings) - 1):
            sim = _cosine_similarity(embeddings[i], embeddings[i + 1])
            coherence_scores.append(sim)

        if coherence_scores:
            avg_coherence = sum(coherence_scores) / len(coherence_scores)
            logger.info(
                f"Hybrid chunking: {len(chunks)} chunks, "
                f"avg inter-chunk similarity={avg_coherence:.3f}"
            )

    except Exception as e:
        logger.warning(f"Semantic validation failed: {e}, using token-based chunks")

    return chunks


def create_semantic_chunking_func(
    embedding_func: EmbeddingFunc | None,
    similarity_threshold: float = 0.8,
    min_chunk_tokens: int = 100,
    max_tokens_for_semantic: int = 100000,
) -> Callable[..., Awaitable[list[dict[str, Any]]]]:
    """Create a semantic chunking function with bound parameters.

    This factory creates a chunking function that matches the expected
    signature for LightRAG's chunking_func parameter while binding
    the embedding function and semantic parameters.

    Args:
        embedding_func: Embedding function to use for semantic analysis.
        similarity_threshold: Percentile threshold for breakpoints (0.0-1.0).
        min_chunk_tokens: Minimum tokens per semantic chunk.
        max_tokens_for_semantic: Max tokens before fallback to token-based.

    Returns:
        Async chunking function compatible with LightRAG chunking_func interface.

    Example:
        >>> rag = LightRAG(
        ...     chunking_func=create_semantic_chunking_func(
        ...         embedding_func=my_embed_func,
        ...         similarity_threshold=0.75
        ...     )
        ... )
    """
    async def _semantic_chunking(
        tokenizer: Tokenizer,
        content: str,
        split_by_character: str | None = None,
        split_by_character_only: bool = False,
        chunk_overlap_token_size: int = 100,
        chunk_token_size: int = 1200,
    ) -> list[dict[str, Any]]:
        return await chunking_by_semantic_similarity(
            tokenizer=tokenizer,
            content=content,
            split_by_character=split_by_character,
            split_by_character_only=split_by_character_only,
            chunk_overlap_token_size=chunk_overlap_token_size,
            chunk_token_size=chunk_token_size,
            embedding_func=embedding_func,
            similarity_threshold=similarity_threshold,
            min_chunk_tokens=min_chunk_tokens,
            max_tokens_for_semantic=max_tokens_for_semantic,
        )

    return _semantic_chunking


def create_hybrid_chunking_func(
    embedding_func: EmbeddingFunc | None,
    similarity_threshold: float = 0.8,
    min_chunk_tokens: int = 100,
    max_tokens_for_semantic: int = 100000,
) -> Callable[..., Awaitable[list[dict[str, Any]]]]:
    """Create a hybrid chunking function with bound parameters.

    Similar to create_semantic_chunking_func but uses the hybrid approach
    that combines token-based chunking with semantic validation.

    Args:
        embedding_func: Embedding function for semantic validation.
        similarity_threshold: Threshold for topic shift detection.
        min_chunk_tokens: Minimum tokens per chunk.
        max_tokens_for_semantic: Max tokens before skipping validation.

    Returns:
        Async chunking function compatible with LightRAG chunking_func interface.
    """
    async def _hybrid_chunking(
        tokenizer: Tokenizer,
        content: str,
        split_by_character: str | None = None,
        split_by_character_only: bool = False,
        chunk_overlap_token_size: int = 100,
        chunk_token_size: int = 1200,
    ) -> list[dict[str, Any]]:
        return await chunking_hybrid(
            tokenizer=tokenizer,
            content=content,
            split_by_character=split_by_character,
            split_by_character_only=split_by_character_only,
            chunk_overlap_token_size=chunk_overlap_token_size,
            chunk_token_size=chunk_token_size,
            embedding_func=embedding_func,
            similarity_threshold=similarity_threshold,
            min_chunk_tokens=min_chunk_tokens,
            max_tokens_for_semantic=max_tokens_for_semantic,
        )

    return _hybrid_chunking
