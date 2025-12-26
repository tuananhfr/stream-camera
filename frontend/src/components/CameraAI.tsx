import { useState, useEffect } from "react";
import { cameraAIApi, type Camera, type HistoryEntry, type Stats } from "../services/cameraAIApi";
import { CameraAISettings } from "./CameraAISettings";
import { CameraView } from "./camera-ai/CameraView";

export const CameraAI = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, in_parking: 0, total_out: 0 });
  const [loading, setLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInParkingOnly, setShowInParkingOnly] = useState(false);

  useEffect(() => {
    loadData();

    // WebSocket for real-time updates
    const ws = cameraAIApi.connectWebSocket((data) => {
      console.log("Camera AI update:", data);
      if (data.type === "history_update") {
        loadHistory();
        loadStats();
      } else if (data.type === "cameras_update") {
        loadCameras();
      }
    });

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    loadHistory();
  }, [searchQuery, showInParkingOnly]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadCameras(), loadHistory(), loadStats()]);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCameras = async () => {
    try {
      const data = await cameraAIApi.getCameras();
      setCameras(data.cameras || []);
    } catch (error) {
      console.error("Failed to load cameras:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await cameraAIApi.getHistory({
        limit: 100,
        search: searchQuery,
        in_parking_only: showInParkingOnly,
      });
      setHistory(data.history || []);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await cameraAIApi.getStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100">
      {/* Header - Stats */}
      <div className="bg-dark border-bottom p-3">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex gap-4">
            <div>
              <div className="text-muted small">Tổng hôm nay</div>
              <div className="h4 mb-0 text-white">{stats.total}</div>
            </div>
            <div>
              <div className="text-muted small">Trong bãi</div>
              <div className="h4 mb-0 text-success">{stats.in_parking}</div>
            </div>
            <div>
              <div className="text-muted small">Đã ra</div>
              <div className="h4 mb-0 text-info">{stats.total_out}</div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-light"
              onClick={() => setShowSettingsModal(true)}
            >
              <i className="bi bi-gear-fill me-2"></i>
              Cài đặt
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowHistoryModal(true)}
            >
              <i className="bi bi-clock-history me-2"></i>
              Lịch sử
            </button>
          </div>
        </div>
      </div>

      {/* Body - Camera Grid */}
      <div className="flex-grow-1 p-2 overflow-hidden">
        <div className="row g-2 h-100">
          {cameras.length === 0 ? (
            <div className="col-12 h-100 d-flex flex-column align-items-center justify-content-center text-muted">
              <i className="bi bi-camera-video-off fs-1 mb-2"></i>
              <div>Chưa có camera nào kết nối</div>
            </div>
          ) : (
            cameras.map((camera) => (
              <div
                key={camera.id}
                className="col-12 col-md-6 col-lg-3"
              >
                <CameraView camera={camera} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clock-history me-2"></i>
                  Lịch sử xe vào/ra
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowHistoryModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Filters */}
                <div className="row g-2 mb-3">
                  <div className="col-md-8">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm theo biển số..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <div className="form-check form-switch d-flex align-items-center h-100">
                      <input
                        className="form-check-input me-2"
                        type="checkbox"
                        id="inParkingFilter"
                        checked={showInParkingOnly}
                        onChange={(e) => setShowInParkingOnly(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="inParkingFilter">
                        Chỉ xe trong bãi
                      </label>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                {history.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    <p>Không có dữ liệu</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Biển số</th>
                          <th>Thời gian vào</th>
                          <th>Thời gian ra</th>
                          <th>Thời lượng</th>
                          <th>Phí</th>
                          <th>Trạng thái</th>
                          <th>Camera</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <strong className="text-primary">
                                {entry.plate_view || entry.plate_id}
                              </strong>
                              {entry.is_anomaly && (
                                <span className="badge bg-warning text-dark ms-2">
                                  Bất thường
                                </span>
                              )}
                            </td>
                            <td>
                              <small>
                                {new Date(entry.entry_time).toLocaleString("vi-VN")}
                              </small>
                            </td>
                            <td>
                              {entry.exit_time ? (
                                <small>
                                  {new Date(entry.exit_time).toLocaleString("vi-VN")}
                                </small>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>{entry.duration || "—"}</td>
                            <td>
                              {entry.fee !== undefined && entry.fee !== null
                                ? `${entry.fee.toLocaleString()} đ`
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  entry.status === "IN" ? "bg-success" : "bg-info"
                                }`}
                              >
                                {entry.status === "IN" ? "Trong bãi" : "Đã ra"}
                              </span>
                            </td>
                            <td>
                              <small className="text-muted">
                                {entry.camera_name || "—"}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHistoryModal(false)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <CameraAISettings
        show={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          loadCameras(); // Reload cameras after settings close
        }}
      />
    </div>
  );
};
