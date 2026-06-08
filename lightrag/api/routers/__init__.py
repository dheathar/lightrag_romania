"""
This module contains all the routers for the LightRAG API.
"""

from .document_routes import router as document_router
from .query_routes import router as query_router
from .graph_routes import router as graph_router
from .config_routes import create_config_routes
from .evaluation_routes import create_evaluation_routes
from .ollama_api import OllamaAPI

__all__ = [
    "document_router",
    "query_router",
    "graph_router",
    "create_config_routes",
    "create_evaluation_routes",
    "OllamaAPI",
]
