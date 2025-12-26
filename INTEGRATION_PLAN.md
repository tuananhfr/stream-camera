# Integration Plan: Merging Features into Frontend-Central + Backend-Central

## Overview

Merge the Cameras, Timelapse, and Parking Locker features from the Node.js-based frontend/backend system into the existing Python-based frontend-central/backend-central system that already has working Camera AI functionality.

**Key Principle:** DO NOT modify backend-central (Python). Only add new tabs/components to frontend-central and migrate API routes.

---

## Current System Architecture

### Working System (Keep as-is)
- **frontend-central** (React) - Has Camera AI tab working ✅
- **backend-central** (Python FastAPI on port 8000) - Full Camera AI implementation with:
  - Camera registry with heartbeat tracking
  - Parking state management
  - P2P communication between centrals
  - WebSocket real-time updates
  - WebRTC video streaming proxy

### System to Migrate From
- **frontend** (React TypeScript on any port) - Has 4 tabs:
  1. Camera - RTSP camera grid with go2rtc streaming
  2. Timelapse - Video timelapse creation with ffmpeg
  3. Parking Locker - Parking backend management
  4. Camera AI - ⚠️ Already in frontend-central, skip this

- **backend** (Node.js Express on port 5000) - Has API routes:
  - `/api/cameras` - Camera CRUD (reads/writes go2rtc.yaml)
  - `/api/timelapse` - Timelapse video creation with ffmpeg
  - `/api/parking/backends` - Parking backend management
  - `/api/camera-ai` - ⚠️ Already in backend-central, skip this

---

## What Needs to be Migrated

### Frontend Components (Add to frontend-central)

#### From `frontend/src/components/`:
1. **CameraGrid.tsx** - Grid display of RTSP cameras
2. **AddCameraModal.tsx** - Modal for adding new camera
3. **EditCameraModal.tsx** - Modal for editing camera
4. **CameraModal.tsx** - Full-screen camera view
5. **VideoPlayer.tsx** - go2rtc WebRTC video player
6. **VideoPlayerThumbnail.tsx** - Thumbnail preview
7. **ParkingLockerApp.tsx** - Parking locker interface
8. **AddParkingBackendModal.tsx** - Add parking backend modal

#### From `frontend/src/services/`:
1. **backendApi.ts** - Camera API service
2. **timelapseApi.ts** - Timelapse API service
3. **parkingBackendApi.ts** - Parking backend API service

#### From `frontend/src/types/`:
1. **camera.ts** - Camera type definitions
2. **parkingBackend.ts** - Parking backend type definitions

#### App.tsx Changes:
- Already has 4 tabs including Camera AI
- Already has sidebar navigation
- Just needs to ensure Camera, Timelapse, Parking tabs are working with backend-central

### Backend Routes (Add to backend-central)

⚠️ **IMPORTANT:** Backend-central is Python FastAPI. Node.js routes need to be rewritten in Python.

#### Routes to Add:

1. **Camera Management** (`/api/cameras`)
   - `GET /api/cameras` - List all cameras from go2rtc.yaml
   - `POST /api/cameras` - Add camera to go2rtc.yaml
   - `PUT /api/cameras/:id` - Update camera
   - `DELETE /api/cameras/:id` - Remove camera
   - **Dependencies:**
     - go2rtc.yaml file reading/writing
     - go2rtc API integration for runtime stream management

2. **Timelapse** (`/api/timelapse`)
   - `POST /api/timelapse` - Create timelapse video with ffmpeg
   - `GET /api/timelapse` - List timelapse videos
   - `GET /api/timelapse/config` - Get auto-timelapse config
   - `PUT /api/timelapse/config` - Update auto-timelapse config
   - **Dependencies:**
     - ffmpeg binary
     - File storage for timelapse videos
     - Multer equivalent (file upload middleware)

3. **Parking Backend Management** (`/api/parking/backends`)
   - `GET /api/parking/backends` - List parking backends
   - `POST /api/parking/backends` - Add parking backend
   - `DELETE /api/parking/backends/:id` - Remove parking backend
   - `PUT /api/parking/backends/:id` - Update parking backend
   - **Dependencies:**
     - JSON file storage for backend list

---

## Detailed Migration Steps

### Phase 1: Frontend Component Migration

#### Step 1.1: Copy Component Files
```bash
# Copy from frontend to frontend-central
frontend/src/components/CameraGrid.tsx → frontend-central/src/components/
frontend/src/components/AddCameraModal.tsx → frontend-central/src/components/
frontend/src/components/EditCameraModal.tsx → frontend-central/src/components/
frontend/src/components/CameraModal.tsx → frontend-central/src/components/
frontend/src/components/VideoPlayer.tsx → frontend-central/src/components/
frontend/src/components/VideoPlayerThumbnail.tsx → frontend-central/src/components/
frontend/src/components/ParkingLockerApp.tsx → frontend-central/src/components/
frontend/src/components/AddParkingBackendModal.tsx → frontend-central/src/components/
```

#### Step 1.2: Copy Service Files
```bash
frontend/src/services/backendApi.ts → frontend-central/src/services/
frontend/src/services/timelapseApi.ts → frontend-central/src/services/
frontend/src/services/parkingBackendApi.ts → frontend-central/src/services/
```

#### Step 1.3: Copy Type Definitions
```bash
frontend/src/types/camera.ts → frontend-central/src/types/
frontend/src/types/parkingBackend.ts → frontend-central/src/types/
```

#### Step 1.4: Update API Base URLs
Change all API calls to point to backend-central (port 8000):
```typescript
// In all service files, update:
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
```

#### Step 1.5: Verify App.tsx
Check if `frontend/src/App.tsx` tabs are already in `frontend-central/src/App.jsx`:
- ✅ Camera tab exists
- ✅ Timelapse tab exists
- ✅ Parking tab exists
- ✅ Camera AI tab exists

**Status:** Frontend-central already has the tab structure! Just need to verify components are working.

---

### Phase 2: Backend API Migration (Python)

⚠️ **CRITICAL:** Do NOT modify existing backend-central code. Only ADD new routes.

#### Step 2.1: Add Camera Routes (Python FastAPI)

**File:** `backend-central/routes/camera_routes.py` (NEW)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yaml
import os

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

CONFIG_FILE = "go2rtc.yaml"

class Camera(BaseModel):
    id: str
    name: str
    type: str
    url: str
    hasAudio: bool = False

@router.get("/")
async def get_cameras():
    """Get all cameras from go2rtc.yaml"""
    if not os.path.exists(CONFIG_FILE):
        return []

    with open(CONFIG_FILE, 'r') as f:
        config = yaml.safe_load(f) or {}

    streams = config.get('streams', {})
    metadata = config.get('metadata', {})

    cameras = []
    for cam_id, url_value in streams.items():
        if cam_id.startswith('#'):
            continue

        # Remove go2rtc params
        url = url_value.split('#')[0] if '#' in url_value else url_value

        meta = metadata.get(cam_id, {})
        cameras.append({
            'id': cam_id,
            'name': meta.get('name', cam_id),
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
        with open(CONFIG_FILE, 'r') as f:
            config = yaml.safe_load(f) or {}

    if 'streams' not in config:
        config['streams'] = {}
    if 'metadata' not in config:
        config['metadata'] = {}

    # Check duplicate
    if camera.id in config['streams']:
        raise HTTPException(status_code=400, detail=f"Camera with name '{camera.name}' already exists")

    # Add camera
    config['streams'][camera.id] = camera.url
    config['metadata'][camera.id] = {
        'name': camera.name,
        'type': camera.type,
        'hasAudio': camera.hasAudio
    }

    # Write config
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

    return {"success": True, "message": "Camera added successfully"}

@router.put("/{cam_id}")
async def update_camera(cam_id: str, camera: Camera):
    """Update camera in go2rtc.yaml"""
    # Implementation similar to add_camera
    pass

@router.delete("/{cam_id}")
async def delete_camera(cam_id: str):
    """Remove camera from go2rtc.yaml"""
    # Implementation
    pass
```

**Register route in app.py:**
```python
from routes import camera_routes
app.include_router(camera_routes.router)
```

#### Step 2.2: Add Timelapse Routes (Python FastAPI)

**File:** `backend-central/routes/timelapse_routes.py` (NEW)

```python
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import json
from datetime import datetime

router = APIRouter(prefix="/api/timelapse", tags=["timelapse"])

TIMELAPSE_DIR = "timelapse"
TIMELAPSE_CONFIG_PATH = "timelapse.config.json"

@router.post("/")
async def create_timelapse(
    file: UploadFile = File(None),
    source: str = Form(None),
    intervalSeconds: int = Form(...)
):
    """Create timelapse video using ffmpeg"""
    # Similar logic to Node.js version but using Python subprocess
    pass

@router.get("/")
async def list_timelapse():
    """List all timelapse videos"""
    pass

@router.get("/config")
async def get_timelapse_config():
    """Get timelapse configuration"""
    pass

@router.put("/config")
async def update_timelapse_config():
    """Update timelapse configuration"""
    pass
```

**Register route in app.py:**
```python
from routes import timelapse_routes
app.include_router(timelapse_routes.router)
```

#### Step 2.3: Add Parking Backend Routes (Python FastAPI)

**File:** `backend-central/routes/parking_backend_routes.py` (NEW)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os

router = APIRouter(prefix="/api/parking/backends", tags=["parking-backends"])

PARKING_BACKENDS_FILE = "parking.backends.json"

class ParkingBackend(BaseModel):
    id: str
    name: str
    host: str
    port: int
    description: str = ""
    enabled: bool = True

@router.get("/")
async def get_parking_backends():
    """Get all parking backends"""
    if not os.path.exists(PARKING_BACKENDS_FILE):
        return {"success": True, "data": []}

    with open(PARKING_BACKENDS_FILE, 'r') as f:
        backends = json.load(f)

    return {"success": True, "data": backends}

@router.post("/")
async def add_parking_backend(backend: ParkingBackend):
    """Add new parking backend"""
    # Implementation
    pass

@router.delete("/{backend_id}")
async def delete_parking_backend(backend_id: str):
    """Delete parking backend"""
    pass

@router.put("/{backend_id}")
async def update_parking_backend(backend_id: str, backend: ParkingBackend):
    """Update parking backend"""
    pass
```

**Register route in app.py:**
```python
from routes import parking_backend_routes
app.include_router(parking_backend_routes.router)
```

---

### Phase 3: Static File Serving

Backend-central needs to serve timelapse videos:

```python
from fastapi.staticfiles import StaticFiles

# In app.py
app.mount("/timelapse", StaticFiles(directory="timelapse"), name="timelapse")
```

---

### Phase 4: Testing Strategy

#### Test 1: Camera Tab
1. Open frontend-central at `http://localhost:3000` (or configured port)
2. Click Camera tab
3. Click "Add Camera" → Add RTSP camera
4. Verify camera appears in grid
5. Verify video plays via go2rtc WebRTC
6. Edit camera → Verify changes saved
7. Delete camera → Verify removed

#### Test 2: Timelapse Tab
1. Click Timelapse tab
2. Enter video source (URL or upload file)
3. Set interval (e.g., 5 seconds)
4. Click "Add Timelapse"
5. Verify timelapse video created
6. Verify video appears in list
7. Click video → Verify plays in modal

#### Test 3: Parking Locker Tab
1. Click Parking Locker tab
2. Click "Manage Backends"
3. Add parking backend (name, host, port)
4. Verify backend appears in list
5. Select backend
6. Verify ParkingLockerApp loads

#### Test 4: Camera AI Tab (Already Working)
1. Click Camera AI tab
2. Verify existing Camera AI functionality works
3. Verify heartbeat tracking works
4. Verify WebSocket updates work

---

## File Structure After Migration

```
stream-camera/
├── frontend-central/           # React frontend (main)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraGrid.tsx          ✅ Added
│   │   │   ├── AddCameraModal.tsx      ✅ Added
│   │   │   ├── EditCameraModal.tsx     ✅ Added
│   │   │   ├── CameraModal.tsx         ✅ Added
│   │   │   ├── VideoPlayer.tsx         ✅ Added
│   │   │   ├── VideoPlayerThumbnail.tsx ✅ Added
│   │   │   ├── ParkingLockerApp.tsx    ✅ Added
│   │   │   ├── AddParkingBackendModal.tsx ✅ Added
│   │   │   ├── CameraAI.tsx            ✅ Existing (keep)
│   │   │   └── CameraAISettings.tsx    ✅ Existing (keep)
│   │   ├── services/
│   │   │   ├── backendApi.ts           ✅ Added
│   │   │   ├── timelapseApi.ts         ✅ Added
│   │   │   ├── parkingBackendApi.ts    ✅ Added
│   │   │   └── cameraAIApi.ts          ✅ Existing (keep)
│   │   ├── types/
│   │   │   ├── camera.ts               ✅ Added
│   │   │   └── parkingBackend.ts       ✅ Added
│   │   └── App.jsx                     ✅ Update tabs
│   └── package.json
│
├── backend-central/            # Python FastAPI backend (main)
│   ├── app.py                  ⚠️ DO NOT MODIFY (only add router imports)
│   ├── routes/
│   │   ├── camera_routes.py            ✅ NEW
│   │   ├── timelapse_routes.py         ✅ NEW
│   │   └── parking_backend_routes.py   ✅ NEW
│   ├── go2rtc.yaml             ✅ Create if not exists
│   ├── timelapse/              ✅ Create directory
│   ├── parking.backends.json   ✅ Create if not exists
│   ├── database.py             ✅ Existing (keep)
│   ├── camera_registry.py      ✅ Existing (keep)
│   ├── parking_state.py        ✅ Existing (keep)
│   └── config.py               ✅ Existing (keep)
│
├── frontend/                   ❌ DEPRECATED (archive or remove)
└── backend/                    ❌ DEPRECATED (archive or remove)
```

---

## Dependencies to Install

### Frontend-central
Already has React, TypeScript, Vite, Bootstrap - should be OK.

### Backend-central
Need to add:
```bash
pip install pyyaml  # For go2rtc.yaml parsing
```

System dependencies:
- **ffmpeg** - For timelapse video creation
- **go2rtc** - For camera streaming (may need to run as separate service)

---

## Configuration

### Environment Variables

**Frontend-central `.env`:**
```bash
VITE_BACKEND_URL=http://localhost:8000
```

**Backend-central `.env` or `config.py`:**
```python
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000
```

---

## Potential Issues & Solutions

### Issue 1: go2rtc Integration
**Problem:** Backend-central needs to read/write go2rtc.yaml and communicate with go2rtc runtime

**Solution:**
- Option A: Run go2rtc as separate service, backend-central uses go2rtc API
- Option B: Embed go2rtc binary and manage as subprocess (like Node.js backend does)

### Issue 2: ffmpeg Dependency
**Problem:** Timelapse requires ffmpeg binary

**Solution:**
- Ensure ffmpeg is installed on system (`apt install ffmpeg` or `brew install ffmpeg`)
- Check ffmpeg availability on startup: `subprocess.run(["ffmpeg", "-version"])`

### Issue 3: File Upload in Python
**Problem:** Node.js uses multer for file uploads, need Python equivalent

**Solution:**
- FastAPI has built-in `UploadFile` support
- Save to uploads directory: `with open(filepath, 'wb') as f: f.write(await file.read())`

### Issue 4: Port Conflicts
**Problem:** Backend-central on 8000, but some configs may reference 5000/5001

**Solution:**
- Ensure all frontend service files use `VITE_BACKEND_URL` environment variable
- Update `.env` to point to port 8000

---

## Rollback Strategy

If migration fails:
1. Keep frontend + backend (Node.js) running as backup
2. Frontend-central can temporarily point back to port 5000
3. Restore go2rtc.yaml from backup
4. Remove new Python route files

---

## Success Criteria

✅ Frontend-central has 4 working tabs:
  - Camera (RTSP camera grid)
  - Timelapse (video timelapse creation)
  - Parking Locker (backend management)
  - Camera AI (existing functionality preserved)

✅ Backend-central serves all APIs on port 8000:
  - `/api/cameras` - CRUD operations
  - `/api/timelapse` - Video creation & listing
  - `/api/parking/backends` - Backend management
  - `/api/camera-ai` - Existing Camera AI APIs (unchanged)
  - `/api/parking/*` - Existing parking APIs (unchanged)

✅ All features work together without conflicts

✅ Camera AI heartbeat tracking continues to work

✅ No modification to existing backend-central Camera AI code

---

## Timeline Estimate

**Phase 1 (Frontend):** 2-3 hours
- Copy component files
- Update imports
- Fix TypeScript/JSX compatibility
- Update API URLs

**Phase 2 (Backend):** 4-6 hours
- Write Python route equivalents
- Implement go2rtc.yaml reading/writing
- Implement ffmpeg timelapse logic
- Test file uploads

**Phase 3 (Integration Testing):** 2-3 hours
- Test each tab individually
- Test tab switching
- Test cross-feature interactions
- Fix bugs

**Phase 4 (Cleanup):** 1 hour
- Archive old frontend/backend
- Update documentation
- Create deployment guide

**Total:** 9-13 hours

---

## Next Steps

1. ✅ Create this integration plan
2. Backup current working systems (frontend-central + backend-central)
3. Start Phase 1: Copy frontend components
4. Start Phase 2: Write Python backend routes
5. Test incrementally (one tab at a time)
6. Finalize and archive old system

---

## Notes

- **Do NOT touch Camera AI code** - It's the most complex feature and already working
- **Microservices approach is acceptable** - Can keep Node.js backend for cameras/timelapse if Python migration is too complex
- **Frontend is React JSX** - May need to convert some TSX to JSX or add TypeScript support
- **Backend-central already has robust architecture** - Follow existing patterns for new routes
