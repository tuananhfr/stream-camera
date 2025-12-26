import { useState, useEffect } from "react";

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
}

interface CameraConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  camera_type: "ENTRY" | "EXIT" | "PARKING_LOT";
  status: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

export const CameraAISettings = ({ show, onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<"cameras" | "config">("cameras");
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [parkingCapacity, setParkingCapacity] = useState(100);
  const [barrierEnabled, setBarrierEnabled] = useState(false);

  // Add camera form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: "",
    ip: "",
    port: "",
    camera_type: "ENTRY" as "ENTRY" | "EXIT" | "PARKING_LOT",
  });

  useEffect(() => {
    if (show) {
      loadConfig();
    }
  }, [show]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/camera-ai/config`);
      const data = await response.json();

      if (data.success && data.config) {
        // Load cameras from edge_cameras
        if (data.config.edge_cameras) {
          const cameraList = Object.entries(data.config.edge_cameras).map(([id, cam]: [string, any]) => ({
            id,
            name: cam.name || id,
            ip: cam.ip || "",
            port: cam.port || 8000,
            camera_type: cam.camera_type || "ENTRY",
            status: cam.status || "offline",
          }));
          setCameras(cameraList);
        }

        // Load parking lot config
        if (data.config.parking_lot) {
          setParkingCapacity(data.config.parking_lot.capacity || 100);
        }

        // Load barrier config
        if (data.config.barrier) {
          setBarrierEnabled(data.config.barrier.enabled || false);
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = () => {
    if (!newCamera.name || !newCamera.ip || !newCamera.port) {
      alert("Vui lòng nhập đầy đủ thông tin camera (Tên, IP, Port)");
      return;
    }

    const cameraId = `camera_${Date.now()}`;
    setCameras([...cameras, {
      id: cameraId,
      name: newCamera.name,
      ip: newCamera.ip,
      port: parseInt(newCamera.port),
      camera_type: newCamera.camera_type,
      status: "offline",
    }]);

    setNewCamera({ name: "", ip: "", port: "", camera_type: "ENTRY" });
    setShowAddForm(false);
  };

  const handleDeleteCamera = (cameraId: string) => {
    if (confirm("Bạn có chắc muốn xóa camera này?")) {
      setCameras(cameras.filter(c => c.id !== cameraId));
    }
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);

      // Convert cameras array to edge_cameras object
      const edge_cameras: Record<string, any> = {};
      cameras.forEach(cam => {
        edge_cameras[cam.id] = {
          name: cam.name,
          ip: cam.ip,
          port: cam.port,
          camera_type: cam.camera_type,
          status: cam.status,
        };
      });

      const config = {
        backend_type: "central",
        edge_cameras,
        parking_lot: {
          capacity: parkingCapacity,
        },
        barrier: {
          enabled: barrierEnabled,
        },
      };

      const response = await fetch(`${BACKEND_URL}/api/camera-ai/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        alert("Lưu cấu hình thành công!");
        onClose();
      } else {
        alert(`Lỗi: ${data.error || "Không thể lưu cấu hình"}`);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Không thể kết nối đến server");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-gear-fill me-2"></i>
              Cài đặt Camera AI
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "cameras" ? "active" : ""}`}
                  onClick={() => setActiveTab("cameras")}
                >
                  <i className="bi bi-camera-video me-2"></i>
                  Cameras
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                  onClick={() => setActiveTab("config")}
                >
                  <i className="bi bi-sliders me-2"></i>
                  Cấu hình
                </button>
              </li>
            </ul>

            {/* Tab Content */}
            {activeTab === "cameras" && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Danh sách Cameras ({cameras.length})</h6>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    Thêm Camera
                  </button>
                </div>

                {/* Add Camera Form */}
                {showAddForm && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <h6 className="card-title">Thêm Camera Mới</h6>
                      <div className="row g-3">
                        <div className="col-md-3">
                          <label className="form-label">Tên Camera *</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ví dụ: Camera Cổng Vào"
                            value={newCamera.name}
                            onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">IP Address *</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="192.168.1.100"
                            value={newCamera.ip}
                            onChange={(e) => setNewCamera({ ...newCamera, ip: e.target.value })}
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label">Port *</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="8000"
                            value={newCamera.port}
                            onChange={(e) => setNewCamera({ ...newCamera, port: e.target.value })}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Loại Camera *</label>
                          <select
                            className="form-select"
                            value={newCamera.camera_type}
                            onChange={(e) => setNewCamera({ ...newCamera, camera_type: e.target.value as any })}
                          >
                            <option value="ENTRY">ENTRY (Vào)</option>
                            <option value="EXIT">EXIT (Ra)</option>
                            <option value="PARKING_LOT">PARKING_LOT (Bãi đỗ)</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <button
                            className="btn btn-success me-2"
                            onClick={handleAddCamera}
                          >
                            <i className="bi bi-check-circle me-2"></i>
                            Thêm
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowAddForm(false);
                              setNewCamera({ name: "", ip: "", port: "", camera_type: "ENTRY" });
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Camera List */}
                {cameras.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    Chưa có camera nào. Click "Thêm Camera" để thêm camera edge.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Tên</th>
                          <th>IP Address</th>
                          <th>Port</th>
                          <th>Loại</th>
                          <th>Trạng thái</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cameras.map((camera) => (
                          <tr key={camera.id}>
                            <td><code>{camera.id}</code></td>
                            <td><strong>{camera.name}</strong></td>
                            <td>{camera.ip}</td>
                            <td><code>{camera.port}</code></td>
                            <td>
                              <span className={`badge ${
                                camera.camera_type === "ENTRY" ? "bg-success" :
                                camera.camera_type === "EXIT" ? "bg-info" :
                                "bg-warning"
                              }`}>
                                {camera.camera_type}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${
                                camera.status === "online" ? "bg-success" : "bg-secondary"
                              }`}>
                                {camera.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteCamera(camera.id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "config" && (
              <div>
                <h6 className="mb-3">Cấu hình Hệ thống</h6>

                {/* Parking Lot Capacity */}
                <div className="card mb-3">
                  <div className="card-body">
                    <h6 className="card-title">
                      <i className="bi bi-car-front me-2"></i>
                      Sức chứa bãi đỗ
                    </h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Số chỗ tối đa</label>
                        <input
                          type="number"
                          className="form-control"
                          value={parkingCapacity}
                          onChange={(e) => setParkingCapacity(parseInt(e.target.value))}
                          min="1"
                        />
                        <div className="form-text">
                          Số lượng xe tối đa có thể đỗ trong bãi
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barrier Control */}
                <div className="card mb-3">
                  <div className="card-body">
                    <h6 className="card-title">
                      <i className="bi bi-shield-check me-2"></i>
                      Điều khiển Barrier
                    </h6>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="barrierSwitch"
                        checked={barrierEnabled}
                        onChange={(e) => setBarrierEnabled(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="barrierSwitch">
                        Bật điều khiển barrier tự động
                      </label>
                      <div className="form-text">
                        Khi bật, barrier sẽ tự động mở khi phát hiện xe vào/ra
                      </div>
                    </div>
                  </div>
                </div>

                {/* Backend Info */}
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-title">
                      <i className="bi bi-server me-2"></i>
                      Thông tin Backend
                    </h6>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td><strong>Backend Type:</strong></td>
                          <td><span className="badge bg-primary">Central</span></td>
                        </tr>
                        <tr>
                          <td><strong>API URL:</strong></td>
                          <td><code>{BACKEND_URL}/api/camera-ai</code></td>
                        </tr>
                        <tr>
                          <td><strong>WebSocket URL:</strong></td>
                          <td><code>{BACKEND_URL.replace(/^http/, 'ws')}/ws/camera-ai</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Đóng
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveConfig}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Đang lưu...
                </>
              ) : (
                <>
                  <i className="bi bi-save me-2"></i>
                  Lưu cấu hình
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
