import { useState, useEffect } from 'react';
import CameraGrid from './CameraGrid';
import CameraModal from './CameraModal';

const CameraRTSPTab = ({ showAddModal, onCloseAddModal }) => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [newCamera, setNewCamera] = useState({ id: '', name: '', url: '', type: 'rtsp' });

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rtsp-cameras`);
      if (!response.ok) throw new Error('Failed to fetch cameras');
      const data = await response.json();
      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading cameras:', error);
      alert('Failed to load cameras');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!newCamera.id || !newCamera.name || !newCamera.url) {
      alert('Please fill all fields');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/rtsp-cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCamera),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add camera');
      }

      setNewCamera({ id: '', name: '', url: '', type: 'rtsp' });
      onCloseAddModal();
      loadCameras();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteCamera = async (cameraId) => {
    if (!confirm('Delete this camera?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rtsp-cameras/${cameraId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      loadCameras();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCameraClick = (camera) => {
    setSelectedCamera(camera);
    setShowCameraModal(true);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100" style={{ overflow: 'hidden' }}>
      {/* Camera Grid - Full height, no header */}
      <div className="h-100" style={{ minHeight: 0, overflow: 'hidden' }}>
        <CameraGrid cameras={cameras} onCameraClick={handleCameraClick} />
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <>
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content bg-dark text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">Add New Camera</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={onCloseAddModal}></button>
                </div>
                <form onSubmit={handleAddCamera}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Camera ID *</label>
                      <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="camera_1" value={newCamera.id} onChange={(e) => setNewCamera({ ...newCamera, id: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Name *</label>
                      <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Front Door" value={newCamera.name} onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">RTSP URL *</label>
                      <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="rtsp://..." value={newCamera.url} onChange={(e) => setNewCamera({ ...newCamera, url: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Type</label>
                      <select className="form-select bg-dark text-white border-secondary" value={newCamera.type} onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value })}>
                        <option value="rtsp">RTSP</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer border-secondary">
                    <button type="button" className="btn btn-secondary" onClick={onCloseAddModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary"><i className="bi bi-plus-circle me-2"></i>Add</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={onCloseAddModal}></div>
        </>
      )}

      {/* Camera Detail Modal */}
      {showCameraModal && selectedCamera && (
        <CameraModal
          camera={selectedCamera}
          onClose={() => setShowCameraModal(false)}
          onDelete={() => {
            handleDeleteCamera(selectedCamera.id);
            setShowCameraModal(false);
          }}
        />
      )}
    </div>
  );
};

export default CameraRTSPTab;
