from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import subprocess
import os
import json
from datetime import datetime
import asyncio

router = APIRouter(prefix="/api/timelapse", tags=["timelapse"])

# Directories
TIMELAPSE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "timelapse")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
TIMELAPSE_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "timelapse.config.json")

# Ensure directories exist
os.makedirs(TIMELAPSE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

class TimelapseConfig(BaseModel):
    intervalSeconds: int = 600
    periodValue: int = 1
    periodUnit: str = "month"
    enabledCameraIds: list = []


def run_ffmpeg(args, timeout_seconds=300):
    """Run ffmpeg command with timeout"""
    try:
        result = subprocess.run(
            ["ffmpeg"] + args,
            capture_output=True,
            timeout=timeout_seconds,
            text=True
        )
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")
        return True
    except subprocess.TimeoutExpired:
        raise Exception(f"FFmpeg timeout after {timeout_seconds}s")
    except FileNotFoundError:
        raise Exception("FFmpeg not found. Please install ffmpeg.")
    except Exception as e:
        raise Exception(f"FFmpeg execution error: {str(e)}")


@router.post("/")
async def create_timelapse(
    file: Optional[UploadFile] = File(None),
    source: Optional[str] = Form(None),
    intervalSeconds: int = Form(...)
):
    """Create timelapse video using ffmpeg"""
    if not file and not source:
        raise HTTPException(status_code=400, detail="Missing source or file")
    
    if not intervalSeconds or intervalSeconds <= 0:
        raise HTTPException(status_code=400, detail="intervalSeconds must be > 0")

    job_id = f"timelapse_{int(datetime.now().timestamp() * 1000)}"
    job_dir = os.path.join(TIMELAPSE_DIR, job_id)
    frames_dir = os.path.join(job_dir, "frames")
    output_video = os.path.join(job_dir, f"{job_id}.mp4")

    try:
        os.makedirs(frames_dir, exist_ok=True)

        # Determine source file
        if file:
            # Save uploaded file
            file_path = os.path.join(UPLOAD_DIR, f"upload_{int(datetime.now().timestamp() * 1000)}.mp4")
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            effective_source = file_path
        else:
            effective_source = source

        # Step 1: Extract frames
        run_ffmpeg([
            "-y",
            "-i", effective_source,
            "-vf", f"fps=1/{intervalSeconds}",
            os.path.join(frames_dir, "frame_%04d.jpg")
        ])

        # Step 2: Stitch frames into video
        run_ffmpeg([
            "-y",
            "-framerate", "30",
            "-i", os.path.join(frames_dir, "frame_%04d.jpg"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            output_video
        ])

        # Cleanup frames
        import shutil
        try:
            shutil.rmtree(frames_dir)
        except:
            pass

        # Remove uploaded file
        if file and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass

        public_url = f"/timelapse/{job_id}/{job_id}.mp4"
        return {"success": True, "videoUrl": public_url}

    except Exception as error:
        print(f"Timelapse error: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/")
async def list_timelapse():
    """List all timelapse videos"""
    try:
        if not os.path.exists(TIMELAPSE_DIR):
            return {"success": True, "data": []}

        timelapse_list = []
        for entry in os.listdir(TIMELAPSE_DIR):
            entry_path = os.path.join(TIMELAPSE_DIR, entry)
            if os.path.isdir(entry_path):
                job_id = entry
                video_path = os.path.join(entry_path, f"{job_id}.mp4")
                
                if os.path.exists(video_path):
                    stats = os.stat(video_path)
                    timelapse_list.append({
                        "id": job_id,
                        "videoUrl": f"/timelapse/{job_id}/{job_id}.mp4",
                        "createdAt": datetime.fromtimestamp(stats.st_mtime).isoformat()
                    })

        # Sort by creation time descending
        timelapse_list.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

        return {"success": True, "data": timelapse_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_timelapse_config():
    """Get timelapse configuration"""
    try:
        if os.path.exists(TIMELAPSE_CONFIG_PATH):
            with open(TIMELAPSE_CONFIG_PATH, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {
                "intervalSeconds": 600,
                "periodValue": 1,
                "periodUnit": "month",
                "enabledCameraIds": []
            }

        return {"success": True, "data": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config")
async def update_timelapse_config(config: TimelapseConfig):
    """Update timelapse configuration"""
    try:
        config_dict = {
            "intervalSeconds": config.intervalSeconds or 600,
            "periodValue": config.periodValue or 1,
            "periodUnit": config.periodUnit or "month",
            "enabledCameraIds": config.enabledCameraIds or []
        }

        with open(TIMELAPSE_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)

        return {"success": True, "data": config_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
