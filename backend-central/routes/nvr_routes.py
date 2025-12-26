from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import os

router = APIRouter(prefix="/api/nvr/servers", tags=["nvr-servers"])

NVR_SERVERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "nvr.servers.json")

class NVRServer(BaseModel):
    id: str
    name: str
    host: str
    port: int = 5000
    device_id: str  # device_id trong unified_app config
    description: Optional[str] = ""
    enabled: bool = True

class NVRServerUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    device_id: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None


def load_nvr_servers():
    """Load NVR servers from JSON file"""
    if not os.path.exists(NVR_SERVERS_FILE):
        return []

    try:
        with open(NVR_SERVERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []


def save_nvr_servers(servers):
    """Save NVR servers to JSON file"""
    try:
        os.makedirs(os.path.dirname(NVR_SERVERS_FILE), exist_ok=True)
        with open(NVR_SERVERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(servers, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving NVR servers: {e}")


@router.get("/")
async def get_nvr_servers():
    """Get all NVR servers"""
    try:
        servers = load_nvr_servers()
        return {"success": True, "data": servers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def add_nvr_server(server: NVRServer):
    """Add new NVR server"""
    servers = load_nvr_servers()

    # Check for duplicate ID
    if any(s.get('id') == server.id for s in servers):
        raise HTTPException(
            status_code=400,
            detail="NVR server with this ID already exists"
        )

    new_server = {
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "device_id": server.device_id,
        "description": server.description or "",
        "enabled": server.enabled
    }

    servers.append(new_server)
    save_nvr_servers(servers)

    return {"success": True, "data": new_server}


@router.delete("/{server_id}")
async def delete_nvr_server(server_id: str):
    """Remove NVR server"""
    servers = load_nvr_servers()

    filtered = [s for s in servers if s.get('id') != server_id]

    if len(filtered) == len(servers):
        raise HTTPException(status_code=404, detail="NVR server not found")

    save_nvr_servers(filtered)
    return {"success": True, "message": "NVR server removed successfully"}


@router.put("/{server_id}")
async def update_nvr_server(server_id: str, update: NVRServerUpdate):
    """Update NVR server"""
    servers = load_nvr_servers()

    server_index = None
    for i, s in enumerate(servers):
        if s.get('id') == server_id:
            server_index = i
            break

    if server_index is None:
        raise HTTPException(status_code=404, detail="NVR server not found")

    # Update server
    server = servers[server_index]
    if update.name is not None:
        server['name'] = update.name
    if update.host is not None:
        server['host'] = update.host
    if update.port is not None:
        server['port'] = update.port
    if update.device_id is not None:
        server['device_id'] = update.device_id
    if update.description is not None:
        server['description'] = update.description
    if update.enabled is not None:
        server['enabled'] = update.enabled

    servers[server_index] = server
    save_nvr_servers(servers)

    return {"success": True, "data": server}
