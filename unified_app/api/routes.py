"""
FastAPI routes module
"""
import time
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List

from .models import CameraOut, CameraCreate, CameraUpdate
from core.camera_manager import camera_manager


app = FastAPI(title="Unified Camera App", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/cameras", response_model=List[CameraOut])
async def get_cameras():
    return camera_manager.list_cameras()


@app.post("/api/cameras")
async def add_camera(cam: CameraCreate):
    camera_manager.add_camera(cam)
    return {"success": True}


@app.put("/api/cameras/{camera_id}")
async def update_camera(camera_id: str, cam: CameraUpdate):
    camera_manager.update_camera(camera_id, cam)
    return {"success": True}


@app.delete("/api/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    camera_manager.remove_camera(camera_id)
    return {"success": True}


@app.post("/api/detection/start/{camera_id}")
async def start_detection(camera_id: str, fps: float = 5.0):
    camera_manager.start_detection(camera_id, fps=fps)
    return {"success": True}


@app.post("/api/detection/stop/{camera_id}")
async def stop_detection(camera_id: str):
    camera_manager.stop_detection(camera_id)
    return {"success": True}


@app.get("/api/detection/stats")
async def detection_stats():
    return camera_manager.get_stats()


@app.get("/api/preview/{camera_id}")
async def preview_mjpeg(camera_id: str):
    frame, _ = camera_manager.get_frame(camera_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="No frame yet or camera not running")

    def gen():
        while True:
            frame, _ = camera_manager.get_frame(camera_id)
            if frame is None:
                time.sleep(0.1)
                continue
            ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ok:
                continue
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
            )
            time.sleep(0.2)  # ~5 fps

    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")

