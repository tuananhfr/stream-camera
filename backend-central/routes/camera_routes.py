from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import yaml
import os

router = APIRouter(prefix="/api/rtsp-cameras", tags=["rtsp-cameras"])

# go2rtc config file path
CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "go2rtc.yaml")

class Camera(BaseModel):
    id: str
    name: str
    type: str
    url: str
    hasAudio: bool = False

class CameraUpdate(BaseModel):
    url: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    newId: Optional[str] = None

@router.get("/")
async def get_cameras():
    """Get all cameras from go2rtc.yaml"""
    if not os.path.exists(CONFIG_FILE):
        return []

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"Error reading go2rtc.yaml: {e}")
        return []

    streams = config.get('streams', {})
    metadata = config.get('metadata', {})

    cameras = []
    for cam_id, url_value in streams.items():
        if cam_id.startswith('#'):
            continue

        # Remove go2rtc params
        url = url_value.split('#')[0] if '#' in str(url_value) else str(url_value)

        meta = metadata.get(cam_id, {})
        cameras.append({
            'id': cam_id,
            'name': meta.get('name', cam_id.replace('_', ' ').title()),
            'type': meta.get('type', 'rtsp' if url.startswith('rtsp://') else 'public'),
            'url': url,
            'hasAudio': meta.get('hasAudio', False)
        })

    return cameras


@router.post("/")
async def add_camera(camera: Camera):
    """Add new camera to go2rtc.yaml"""
    # Read config
    config = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f) or {}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading config: {e}")

    if 'streams' not in config:
        config['streams'] = {}
    if 'metadata' not in config:
        config['metadata'] = {}

    # Check duplicate
    if camera.id in config['streams']:
        raise HTTPException(
            status_code=400,
            detail=f"Camera with name '{camera.name}' already exists. Please use a different name."
        )

    # Add camera
    config['streams'][camera.id] = camera.url
    config['metadata'][camera.id] = {
        'name': camera.name,
        'type': camera.type,
        'hasAudio': camera.hasAudio
    }

    # Write config
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing config: {e}")

    return {"success": True, "message": "Camera added successfully"}


@router.put("/{cam_id}")
async def update_camera(cam_id: str, update: CameraUpdate):
    """Update camera in go2rtc.yaml"""
    if not os.path.exists(CONFIG_FILE):
        raise HTTPException(status_code=404, detail="Config file not found")

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f) or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config: {e}")

    if 'streams' not in config or cam_id not in config['streams']:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Handle ID change
    target_id = cam_id
    if update.newId and update.newId != cam_id:
        if update.newId in config['streams']:
            raise HTTPException(
                status_code=400,
                detail=f"Camera with name '{update.name or update.newId}' already exists"
            )

        # Migrate to new ID
        config['streams'][update.newId] = config['streams'][cam_id]
        config['metadata'][update.newId] = config.get('metadata', {}).get(cam_id, {})
        del config['streams'][cam_id]
        if cam_id in config.get('metadata', {}):
            del config['metadata'][cam_id]
        target_id = update.newId

    # Update URL
    if update.url:
        config['streams'][target_id] = update.url

    # Update metadata
    if 'metadata' not in config:
        config['metadata'] = {}
    if target_id not in config['metadata']:
        config['metadata'][target_id] = {}

    if update.name is not None:
        config['metadata'][target_id]['name'] = update.name
    if update.type is not None:
        config['metadata'][target_id]['type'] = update.type

    # Write config
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing config: {e}")

    return {
        "success": True,
        "message": "Camera updated successfully",
        "id": target_id
    }


@router.delete("/{cam_id}")
async def delete_camera(cam_id: str):
    """Remove camera from go2rtc.yaml"""
    if not os.path.exists(CONFIG_FILE):
        raise HTTPException(status_code=404, detail="Config file not found")

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f) or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config: {e}")

    if 'streams' not in config or cam_id not in config['streams']:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Remove camera
    del config['streams'][cam_id]
    if 'metadata' in config and cam_id in config['metadata']:
        del config['metadata'][cam_id]

    # Write config
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing config: {e}")

    return {"success": True, "message": "Camera removed successfully"}
