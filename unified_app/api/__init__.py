"""
API module - FastAPI routes and models
"""
from .models import CameraCreate, CameraUpdate, CameraOut, DetectionResult, DetectionResponse

# Import app lazily to avoid circular import
def get_app():
    from .routes import app
    return app

__all__ = [
    "get_app",
    "CameraCreate",
    "CameraUpdate",
    "CameraOut",
    "DetectionResult",
    "DetectionResponse",
]

