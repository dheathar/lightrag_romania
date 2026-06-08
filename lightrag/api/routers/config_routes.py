"""
This module contains configuration-related routes for the LightRAG API.

Exposes server configuration parameters including chunking settings,
query defaults, document processing, and storage configuration for the WebUI.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from lightrag.api.utils_api import get_combined_auth_dependency
from lightrag.utils import logger


class ChunkingConfig(BaseModel):
    """Chunking configuration parameters."""

    method: str = Field(description="Chunking method: TOKEN_SIZE, SEMANTIC, or HYBRID")
    chunk_size: int = Field(description="Maximum tokens per chunk")
    chunk_overlap_size: int = Field(description="Overlapping tokens between chunks")
    semantic_similarity_threshold: float = Field(
        description="Percentile threshold for semantic breakpoint detection (0.0-1.0)"
    )
    semantic_min_chunk_size: int = Field(description="Minimum tokens per semantic chunk")
    semantic_max_tokens: int = Field(
        description="Maximum content tokens before falling back to token-based chunking"
    )


class QueryConfig(BaseModel):
    """Query configuration parameters."""

    top_k: int = Field(description="Default KG entities/relations to retrieve")
    chunk_top_k: int = Field(description="Default text chunks to retrieve")
    max_entity_tokens: int = Field(description="Maximum tokens for entity context")
    max_relation_tokens: int = Field(description="Maximum tokens for relation context")
    max_total_tokens: int = Field(description="Maximum total tokens budget")
    history_turns: int = Field(description="Default conversation history turns")


class RerankConfig(BaseModel):
    """Reranking configuration parameters."""

    enabled: bool = Field(description="Whether reranking is enabled")
    binding: Optional[str] = Field(description="Rerank binding type")
    model: Optional[str] = Field(description="Rerank model name")
    min_score: float = Field(description="Minimum rerank score threshold")


class SummaryConfig(BaseModel):
    """Summary/extraction configuration parameters."""

    language: str = Field(description="Language for summaries")
    max_tokens: int = Field(description="Maximum tokens for summaries")
    context_size: int = Field(description="LLM context size for summaries")


class DocumentProcessingConfig(BaseModel):
    """Document processing configuration parameters."""

    engine: str = Field(description="Document loading engine: DEFAULT or DOCLING")
    docling_available: bool = Field(
        description="Whether Docling is installed and available"
    )
    vision_enabled: bool = Field(
        description="Whether vision model is enabled for figure description"
    )
    vision_model: str = Field(description="Vision LLM model name")
    vision_base_url: str = Field(description="Vision model API base URL")
    vision_prompt: str = Field(description="Prompt sent with each figure image")
    docling_images_scale: float = Field(
        description="Resolution scale for extracted images (1.0 = 72 DPI)"
    )
    max_figures_per_doc: int = Field(
        description="Maximum figures to process per document"
    )


class EntityExtractionConfig(BaseModel):
    """Entity extraction configuration parameters (read-only)."""

    entity_types: list[str] = Field(description="Entity types for NER extraction")
    summary_language: str = Field(description="Language for entity summaries")
    max_gleaning: int = Field(description="Max gleaning iterations for extraction")
    max_extract_input_tokens: int = Field(
        description="Max input tokens per extraction call"
    )
    force_llm_summary_on_merge: int = Field(
        description="Description count threshold to trigger LLM summary on merge"
    )


class ConfigResponse(BaseModel):
    """Complete configuration response."""

    chunking: ChunkingConfig = Field(description="Chunking configuration")
    query: QueryConfig = Field(description="Query configuration")
    rerank: RerankConfig = Field(description="Reranking configuration")
    summary: SummaryConfig = Field(description="Summary configuration")
    document_processing: DocumentProcessingConfig = Field(
        description="Document processing configuration"
    )
    entity_extraction: EntityExtractionConfig = Field(
        description="Entity extraction configuration (read-only)"
    )


# Update models with optional fields for PATCH requests
class ChunkingConfigUpdate(BaseModel):
    """Optional chunking configuration for updates."""

    method: Optional[str] = Field(
        None, description="Chunking method: TOKEN_SIZE, SEMANTIC, or HYBRID"
    )
    chunk_size: Optional[int] = Field(
        None, ge=100, le=10000, description="Maximum tokens per chunk (100-10000)"
    )
    chunk_overlap_size: Optional[int] = Field(
        None, ge=0, le=1000, description="Overlapping tokens (0-1000)"
    )
    semantic_similarity_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Semantic threshold (0.0-1.0)"
    )
    semantic_min_chunk_size: Optional[int] = Field(
        None, ge=10, le=1000, description="Min semantic chunk size (10-1000)"
    )
    semantic_max_tokens: Optional[int] = Field(
        None, ge=1000, le=500000, description="Max tokens for semantic (1000-500000)"
    )

    @field_validator("method")
    @classmethod
    def validate_method(cls, v):
        if v is not None and v not in ["TOKEN_SIZE", "SEMANTIC", "HYBRID"]:
            raise ValueError("method must be TOKEN_SIZE, SEMANTIC, or HYBRID")
        return v

    @model_validator(mode="after")
    def validate_overlap_less_than_size(self):
        """Ensure chunk_overlap_size < chunk_size to prevent degenerate chunking."""
        if (
            self.chunk_size is not None
            and self.chunk_overlap_size is not None
            and self.chunk_overlap_size >= self.chunk_size
        ):
            raise ValueError(
                f"chunk_overlap_size ({self.chunk_overlap_size}) must be less than "
                f"chunk_size ({self.chunk_size})"
            )
        return self


class QueryConfigUpdate(BaseModel):
    """Optional query configuration for updates."""

    top_k: Optional[int] = Field(None, ge=1, le=200, description="KG top_k (1-200)")
    chunk_top_k: Optional[int] = Field(
        None, ge=1, le=100, description="Chunk top_k (1-100)"
    )
    max_entity_tokens: Optional[int] = Field(
        None, ge=100, le=50000, description="Max entity tokens (100-50000)"
    )
    max_relation_tokens: Optional[int] = Field(
        None, ge=100, le=50000, description="Max relation tokens (100-50000)"
    )
    max_total_tokens: Optional[int] = Field(
        None, ge=1000, le=200000, description="Max total tokens (1000-200000)"
    )
    history_turns: Optional[int] = Field(
        None, ge=0, le=10, description="History turns (0-10)"
    )


class RerankConfigUpdate(BaseModel):
    """Optional rerank configuration for updates."""

    min_score: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Min rerank score (0.0-1.0)"
    )


class SummaryConfigUpdate(BaseModel):
    """Optional summary configuration for updates."""

    language: Optional[str] = Field(None, description="Summary language")
    max_tokens: Optional[int] = Field(
        None, ge=100, le=5000, description="Max summary tokens (100-5000)"
    )
    context_size: Optional[int] = Field(
        None, ge=1000, le=100000, description="Context size (1000-100000)"
    )


class DocumentProcessingConfigUpdate(BaseModel):
    """Optional document processing configuration for updates."""

    engine: Optional[str] = Field(None, description="DEFAULT or DOCLING")
    vision_enabled: Optional[bool] = Field(
        None, description="Enable/disable vision model"
    )
    vision_model: Optional[str] = Field(None, description="Vision model name")
    vision_base_url: Optional[str] = Field(None, description="Vision API base URL")
    vision_prompt: Optional[str] = Field(None, description="Vision prompt text")
    docling_images_scale: Optional[float] = Field(
        None, ge=0.5, le=4.0, description="Image scale (0.5-4.0)"
    )
    max_figures_per_doc: Optional[int] = Field(
        None, ge=1, le=100, description="Max figures per doc (1-100)"
    )

    @field_validator("engine")
    @classmethod
    def validate_engine(cls, v):
        if v is not None and v not in ["DEFAULT", "DOCLING"]:
            raise ValueError("engine must be DEFAULT or DOCLING")
        return v


class ConfigUpdateRequest(BaseModel):
    """Request model for updating configuration."""

    chunking: Optional[ChunkingConfigUpdate] = None
    query: Optional[QueryConfigUpdate] = None
    rerank: Optional[RerankConfigUpdate] = None
    summary: Optional[SummaryConfigUpdate] = None
    document_processing: Optional[DocumentProcessingConfigUpdate] = None


class ConfigUpdateResponse(BaseModel):
    """Response model for configuration update."""

    status: str = Field(description="Update status")
    message: str = Field(description="Status message")
    updated_fields: list[str] = Field(description="List of updated field paths")


def create_config_routes(args, api_key: str | None, rerank_enabled: bool):
    """Create configuration routes with bound parameters.

    Args:
        args: Parsed command line/environment arguments
        api_key: API key for authentication (if configured)
        rerank_enabled: Whether reranking is enabled

    Returns:
        APIRouter: Router with configuration endpoints
    """
    router = APIRouter(
        prefix="/config",
        tags=["configuration"],
    )

    combined_auth = get_combined_auth_dependency(api_key)

    @router.get(
        "",
        dependencies=[Depends(combined_auth)],
        response_model=ConfigResponse,
        summary="Get server configuration",
        description="Returns current server configuration including chunking, query, document processing, and reranking settings",
    )
    async def get_config() -> ConfigResponse:
        """Get current server configuration for the Settings panel."""
        from lightrag.api.routers.document_routes import _is_docling_available

        return ConfigResponse(
            chunking=ChunkingConfig(
                method=args.chunking_method,
                chunk_size=args.chunk_size,
                chunk_overlap_size=args.chunk_overlap_size,
                semantic_similarity_threshold=args.semantic_similarity_threshold,
                semantic_min_chunk_size=args.semantic_min_chunk_size,
                semantic_max_tokens=args.semantic_max_tokens,
            ),
            query=QueryConfig(
                top_k=args.top_k,
                chunk_top_k=args.chunk_top_k,
                max_entity_tokens=args.max_entity_tokens,
                max_relation_tokens=args.max_relation_tokens,
                max_total_tokens=args.max_total_tokens,
                history_turns=args.history_turns,
            ),
            rerank=RerankConfig(
                enabled=rerank_enabled,
                binding=args.rerank_binding if rerank_enabled else None,
                model=args.rerank_model if rerank_enabled else None,
                min_score=args.min_rerank_score,
            ),
            summary=SummaryConfig(
                language=args.summary_language,
                max_tokens=args.summary_max_tokens,
                context_size=args.summary_context_size,
            ),
            document_processing=DocumentProcessingConfig(
                engine=getattr(args, "document_loading_engine", "DEFAULT"),
                docling_available=_is_docling_available(),
                vision_enabled=getattr(args, "vision_enabled", False),
                vision_model=getattr(args, "vision_model", ""),
                vision_base_url=getattr(args, "vision_base_url", ""),
                vision_prompt=getattr(args, "vision_prompt", ""),
                docling_images_scale=getattr(args, "docling_images_scale", 2.0),
                max_figures_per_doc=getattr(args, "max_figures_per_doc", 20),
            ),
            entity_extraction=EntityExtractionConfig(
                entity_types=getattr(args, "entity_types", []),
                summary_language=getattr(args, "summary_language", "English"),
                max_gleaning=getattr(args, "max_gleaning", 1),
                max_extract_input_tokens=getattr(
                    args, "max_extract_input_tokens", 20480
                ),
                force_llm_summary_on_merge=getattr(
                    args, "force_llm_summary_on_merge", 8
                ),
            ),
        )

    @router.patch(
        "",
        dependencies=[Depends(combined_auth)],
        response_model=ConfigUpdateResponse,
        summary="Update server configuration",
        description="Update server configuration at runtime. Changes apply immediately but reset on restart.",
    )
    async def update_config(update: ConfigUpdateRequest) -> ConfigUpdateResponse:
        """Update server configuration at runtime."""
        updated_fields: list[str] = []

        try:
            # Update chunking settings
            if update.chunking:
                # Pre-validate: compute resulting values BEFORE applying
                new_chunk_size = (
                    update.chunking.chunk_size
                    if update.chunking.chunk_size is not None
                    else args.chunk_size
                )
                new_overlap = (
                    update.chunking.chunk_overlap_size
                    if update.chunking.chunk_overlap_size is not None
                    else args.chunk_overlap_size
                )
                if new_overlap >= new_chunk_size:
                    raise ValueError(
                        f"chunk_overlap_size ({new_overlap}) must be less than "
                        f"chunk_size ({new_chunk_size}). "
                        f"Current chunk_size={args.chunk_size}, "
                        f"current overlap={args.chunk_overlap_size}."
                    )

                # Apply after validation passes
                if update.chunking.method is not None:
                    args.chunking_method = update.chunking.method
                    updated_fields.append("chunking.method")
                if update.chunking.chunk_size is not None:
                    args.chunk_size = update.chunking.chunk_size
                    updated_fields.append("chunking.chunk_size")
                if update.chunking.chunk_overlap_size is not None:
                    args.chunk_overlap_size = update.chunking.chunk_overlap_size
                    updated_fields.append("chunking.chunk_overlap_size")
                if update.chunking.semantic_similarity_threshold is not None:
                    args.semantic_similarity_threshold = (
                        update.chunking.semantic_similarity_threshold
                    )
                    updated_fields.append("chunking.semantic_similarity_threshold")
                if update.chunking.semantic_min_chunk_size is not None:
                    args.semantic_min_chunk_size = update.chunking.semantic_min_chunk_size
                    updated_fields.append("chunking.semantic_min_chunk_size")
                if update.chunking.semantic_max_tokens is not None:
                    args.semantic_max_tokens = update.chunking.semantic_max_tokens
                    updated_fields.append("chunking.semantic_max_tokens")

            # Update query settings
            if update.query:
                if update.query.top_k is not None:
                    args.top_k = update.query.top_k
                    updated_fields.append("query.top_k")
                if update.query.chunk_top_k is not None:
                    args.chunk_top_k = update.query.chunk_top_k
                    updated_fields.append("query.chunk_top_k")
                if update.query.max_entity_tokens is not None:
                    args.max_entity_tokens = update.query.max_entity_tokens
                    updated_fields.append("query.max_entity_tokens")
                if update.query.max_relation_tokens is not None:
                    args.max_relation_tokens = update.query.max_relation_tokens
                    updated_fields.append("query.max_relation_tokens")
                if update.query.max_total_tokens is not None:
                    args.max_total_tokens = update.query.max_total_tokens
                    updated_fields.append("query.max_total_tokens")
                if update.query.history_turns is not None:
                    args.history_turns = update.query.history_turns
                    updated_fields.append("query.history_turns")

            # Update rerank settings
            if update.rerank:
                if update.rerank.min_score is not None:
                    args.min_rerank_score = update.rerank.min_score
                    updated_fields.append("rerank.min_score")

            # Update summary settings
            if update.summary:
                if update.summary.language is not None:
                    args.summary_language = update.summary.language
                    updated_fields.append("summary.language")
                if update.summary.max_tokens is not None:
                    args.summary_max_tokens = update.summary.max_tokens
                    updated_fields.append("summary.max_tokens")
                if update.summary.context_size is not None:
                    args.summary_context_size = update.summary.context_size
                    updated_fields.append("summary.context_size")

            # Update document processing settings
            if update.document_processing:
                dp = update.document_processing
                if dp.engine is not None:
                    args.document_loading_engine = dp.engine
                    updated_fields.append("document_processing.engine")
                if dp.vision_enabled is not None:
                    args.vision_enabled = dp.vision_enabled
                    updated_fields.append("document_processing.vision_enabled")
                if dp.vision_model is not None:
                    args.vision_model = dp.vision_model
                    updated_fields.append("document_processing.vision_model")
                if dp.vision_base_url is not None:
                    args.vision_base_url = dp.vision_base_url
                    updated_fields.append("document_processing.vision_base_url")
                if dp.vision_prompt is not None:
                    args.vision_prompt = dp.vision_prompt
                    updated_fields.append("document_processing.vision_prompt")
                if dp.docling_images_scale is not None:
                    args.docling_images_scale = dp.docling_images_scale
                    updated_fields.append("document_processing.docling_images_scale")
                if dp.max_figures_per_doc is not None:
                    args.max_figures_per_doc = dp.max_figures_per_doc
                    updated_fields.append("document_processing.max_figures_per_doc")

            if not updated_fields:
                return ConfigUpdateResponse(
                    status="no_change",
                    message="No fields were updated",
                    updated_fields=[],
                )

            logger.info(f"Configuration updated: {updated_fields}")

            return ConfigUpdateResponse(
                status="success",
                message=f"Updated {len(updated_fields)} field(s). Changes apply to new operations.",
                updated_fields=updated_fields,
            )

        except Exception as e:
            logger.error(f"Failed to update configuration: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return router
