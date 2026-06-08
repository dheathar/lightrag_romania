"""
Vision model utilities for describing figures, charts, and diagrams extracted from PDFs.

Uses OpenAI-compatible vision API (works with OpenRouter, OpenAI, Azure, etc.)
via the existing openai_complete_if_cache function.
"""

import asyncio
import base64
import io
from typing import Any

from lightrag.utils import logger


def pil_image_to_base64(pil_image) -> str:
    """Convert a PIL Image to a base64-encoded PNG string.

    Args:
        pil_image: PIL Image object

    Returns:
        Base64 encoded string of the PNG image
    """
    buf = io.BytesIO()
    try:
        pil_image.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    finally:
        buf.close()


async def describe_image_with_vision(
    image_base64: str,
    model: str,
    api_key: str,
    base_url: str,
    prompt: str,
    timeout: int = 60,
) -> str:
    """Send an image to a vision-capable LLM and get a text description.

    Uses the existing openai_complete_if_cache function with the messages= kwarg
    override pattern to pass multipart content (text + image).

    Args:
        image_base64: Base64-encoded PNG image string
        model: Vision model name (e.g., 'google/gemini-2.0-flash-001')
        api_key: API key for the vision model provider
        base_url: Base URL for the API endpoint
        prompt: Text prompt to send with the image
        timeout: Request timeout in seconds

    Returns:
        Text description of the image
    """
    from lightrag.llm.openai import openai_complete_if_cache

    try:
        description = await openai_complete_if_cache(
            model=model,
            prompt="",  # overridden by messages kwarg
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            },
                        },
                    ],
                }
            ],
        )
        return description.strip() if description else ""
    except Exception as e:
        logger.error(f"Vision model error: {e}")
        return "[Figure description unavailable]"


async def describe_figures_batch(
    figures: list[dict[str, Any]],
    model: str,
    api_key: str,
    base_url: str,
    prompt: str,
    max_figures: int = 20,
    max_concurrent: int = 3,
    timeout: int = 60,
) -> list[dict[str, Any]]:
    """Describe multiple figures in parallel with concurrency limiting.

    Args:
        figures: List of dicts with 'index', 'base64', 'caption' keys
        model: Vision model name
        api_key: API key
        base_url: API base URL
        prompt: Vision prompt template
        max_figures: Maximum number of figures to process
        max_concurrent: Maximum concurrent vision API calls
        timeout: Per-request timeout in seconds

    Returns:
        List of dicts with 'index', 'caption', 'description' keys
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    figures_to_process = figures[:max_figures]

    if len(figures) > max_figures:
        logger.warning(
            f"Document has {len(figures)} figures, processing only first {max_figures}"
        )

    async def describe_one(figure: dict) -> dict:
        async with semaphore:
            description = await describe_image_with_vision(
                image_base64=figure["base64"],
                model=model,
                api_key=api_key,
                base_url=base_url,
                prompt=prompt,
                timeout=timeout,
            )
            return {
                "index": figure["index"],
                "caption": figure.get("caption", ""),
                "description": description,
            }

    results = await asyncio.gather(
        *[describe_one(fig) for fig in figures_to_process],
        return_exceptions=True,
    )

    # Filter out exceptions and log them
    described = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            fig_index = figures_to_process[i].get("index", i + 1)
            logger.error(f"Failed to describe figure {fig_index}: {result}")
            described.append(
                {
                    "index": fig_index,
                    "caption": figures_to_process[i].get("caption", ""),
                    "description": "[Figure description unavailable]",
                }
            )
        else:
            described.append(result)

    return described


def inject_figure_descriptions(
    markdown: str, described_figures: list[dict[str, Any]]
) -> str:
    """Inject figure descriptions into the markdown content.

    Appends a 'Visual Content Descriptions' section at the end of the document
    with detailed descriptions of each figure from the vision model.

    Args:
        markdown: Original markdown content from Docling
        described_figures: List of dicts with 'index', 'caption', 'description'

    Returns:
        Enriched markdown with figure descriptions appended
    """
    if not described_figures:
        return markdown

    sections = ["\n\n---\n\n## Visual Content Descriptions\n"]
    sections.append(
        "The following descriptions were generated from figures, charts, "
        "and diagrams found in this document.\n"
    )

    for fig in described_figures:
        caption_text = f" ({fig['caption']})" if fig.get("caption") else ""
        sections.append(f"\n### Figure {fig['index']}{caption_text}\n")
        sections.append(f"{fig['description']}\n")

    return markdown + "".join(sections)
