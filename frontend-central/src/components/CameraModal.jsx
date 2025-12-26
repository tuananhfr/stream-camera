import { useState } from 'react';
import VideoPlayer from './VideoPlayer';

const CameraModal = ({ camera, onClose, onDelete }) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleFullscreen = () => {
    const element = document.querySelector('.camera-modal-video');
    if (element) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        element.requestFullscreen();
      }
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content bg-dark text-white">
            <div className="modal-header border-secondary">
              <h5 className="modal-title">{camera.name}</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body p-0 position-relative camera-modal-video">
              <div className="position-relative h-100 w-100" style={{ transform: `scale(${zoom})` }}>
                <VideoPlayer camera={camera} />
              </div>

              {/* Video Controls */}
              <div className="position-absolute bottom-0 start-0 w-100 p-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  {/* Zoom Controls */}
                  <div className="btn-group" role="group">
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={handleZoomOut}
                      disabled={zoom <= 0.5}
                      title="Zoom Out"
                    >
                      <i className="bi bi-zoom-out"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={handleResetZoom}
                      disabled={zoom === 1}
                      title="Reset Zoom"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={handleZoomIn}
                      disabled={zoom >= 5}
                      title="Zoom In"
                    >
                      <i className="bi bi-zoom-in"></i>
                    </button>
                  </div>

                  {/* Right Controls */}
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={handleFullscreen}
                      title="Fullscreen"
                    >
                      <i className="bi bi-fullscreen"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={onDelete}
                      title="Delete Camera"
                    >
                      <i className="bi bi-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  );
};

export default CameraModal;
