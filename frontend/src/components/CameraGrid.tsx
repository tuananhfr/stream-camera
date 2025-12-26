import { useState } from "react";
import { VideoPlayerThumbnail } from "./VideoPlayerThumbnail";
import type { Camera } from "../types/camera";

interface CameraGridProps {
  cameras: Camera[];
  onRemoveCamera: (cameraId: string) => void;
  onEditCamera: (camera: Camera) => void;
  onCameraClick: (camera: Camera) => void;
}

const CAMERAS_PER_PAGE = 16; // 4x4 grid

export const CameraGrid = ({
  cameras,
  onRemoveCamera: _onRemoveCamera,
  onEditCamera: _onEditCamera,
  onCameraClick,
}: CameraGridProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (cameras.length === 0) {
    return (
      <div className="alert alert-info text-center" role="alert">
        <i className="bi bi-camera-video-off fs-1 d-block mb-3"></i>
        <h4>No cameras added yet</h4>
        <p className="mb-0">Click the "Add Camera" button to start streaming</p>
      </div>
    );
  }

  const totalPages = Math.ceil(cameras.length / CAMERAS_PER_PAGE);
  const startIndex = (currentPage - 1) * CAMERAS_PER_PAGE;
  const endIndex = startIndex + CAMERAS_PER_PAGE;
  const currentCameras = cameras.slice(startIndex, endIndex);

  return (
    <div className="camera-grid-container">
      {/* 4x4 Grid - Phủ kín toàn bộ màn hình, không scroll */}
      <div className="camera-grid">
        {currentCameras.map((camera) => (
          <div
            key={camera.id}
            className="d-flex h-100 w-100 overflow-hidden"
            style={{ minHeight: 0, minWidth: 0 }}
          >
            <VideoPlayerThumbnail
              camera={camera}
              onClick={() => onCameraClick(camera)}
            />
          </div>
        ))}
        {/* Fill empty slots to maintain grid layout */}
        {Array.from({ length: CAMERAS_PER_PAGE - currentCameras.length }).map(
          (_, index) => (
            <div
              key={`empty-${index}`}
              className="d-flex h-100 w-100 overflow-hidden"
              style={{ minHeight: 0, minWidth: 0 }}
            >
              <div className="card bg-dark border-secondary w-100 h-100 d-flex flex-column overflow-hidden">
                <div
                  className="card-header p-1 flex-shrink-0"
                  style={{
                    minHeight: "24px",
                    maxHeight: "24px",
                    padding: "2px 4px",
                  }}
                >
                  <h6
                    className="card-title mb-0 text-truncate"
                    style={{ fontSize: "0.7rem", lineHeight: "1.2" }}
                  >
                    Empty
                  </h6>
                </div>
                <div className="card-body p-0 position-relative flex-grow-1 d-flex align-items-center justify-content-center overflow-hidden bg-black">
                  <span
                    className="text-secondary"
                    style={{ fontSize: "0.75rem" }}
                  >
                    Empty
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Pagination - Overlay ở góc dưới, nhỏ gọn */}
      {totalPages > 1 && (
        <div
          className="position-absolute bottom-0 start-50 translate-middle-x bg-dark rounded p-1 mb-1"
          style={{ zIndex: 10, background: "rgba(0, 0, 0, 0.8)" }}
        >
          <nav className="d-flex justify-content-center align-items-center gap-1">
            <button
              className="btn btn-sm btn-dark text-white border-secondary"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{ padding: "2px 6px", fontSize: "0.75rem" }}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span
              className="text-white"
              style={{ fontSize: "0.75rem", padding: "0 4px" }}
            >
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-sm btn-dark text-white border-secondary"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              style={{ padding: "2px 6px", fontSize: "0.75rem" }}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};
