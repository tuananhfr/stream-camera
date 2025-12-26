"""
API Models - Pydantic models for FastAPI
"""
from typing import Optional, List
from pydantic import BaseModel


class CameraCreate(BaseModel):
    id: str
    url: str
    name: Optional[str] = None
    type: str = "rtsp"


class CameraUpdate(BaseModel):
    url: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None


class CameraOut(BaseModel):
    id: str
    url: str
    name: str
    type: str


class DetectionResult(BaseModel):
    bbox: List[int]
    confidence: float
    class_id: int
    class_name: str


class DetectionResponse(BaseModel):
    detections: List[DetectionResult]
    count: int
    processing_time_ms: float

