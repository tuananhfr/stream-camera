import React, { useState, useEffect } from "react";
import { CameraGrid } from "./components/CameraGrid";
import { AddCameraModal } from "./components/AddCameraModal";
import { EditCameraModal } from "./components/EditCameraModal";
import { CameraModal } from "./components/CameraModal";
import { AddParkingBackendModal } from "./components/AddParkingBackendModal";
import { backendApi } from "./services/backendApi";
import { parkingBackendApi } from "./services/parkingBackendApi";
import {
  timelapseApi,
  type TimelapseItem,
  type TimelapseConfig,
} from "./services/timelapseApi";
import type { Camera } from "./types/camera";
import type { ParkingBackend } from "./types/parkingBackend";
import "./App.css";
import { ParkingLockerApp } from "./components/ParkingLockerApp";
import { CameraAI } from "./components/CameraAI";

function App() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"camera" | "timelapse" | "parking" | "camera-ai">("camera");
  const [timelapseSource, setTimelapseSource] = useState("");
  const [timelapseInterval, setTimelapseInterval] = useState(5);
  const [timelapseUnit, setTimelapseUnit] = useState<
    "seconds" | "minutes" | "hours"
  >("seconds");
  const [timelapseVideoUrl, setTimelapseVideoUrl] = useState("");
  const [creatingTimelapse, setCreatingTimelapse] = useState(false);
  const [timelapseFile, setTimelapseFile] = useState<File | null>(null);
  const [timelapseList, setTimelapseList] = useState<TimelapseItem[]>([]);
  const [loadingTimelapse, setLoadingTimelapse] = useState(false);
  const [showTimelapseModal, setShowTimelapseModal] = useState(false);
  const [selectedTimelapse, setSelectedTimelapse] =
    useState<TimelapseItem | null>(null);
  const [timelapseConfig, setTimelapseConfig] =
    useState<TimelapseConfig | null>(null);
  const [savingTimelapseConfig, setSavingTimelapseConfig] = useState(false);
  const [autoIntervalValue, setAutoIntervalValue] = useState(600);
  const [autoIntervalUnit, setAutoIntervalUnit] = useState<
    "seconds" | "minutes" | "hours"
  >("seconds");
  const [periodValue, setPeriodValue] = useState(1);
  const [periodUnit, setPeriodUnit] = useState<
    "hour" | "day" | "month" | "year"
  >("month");
  const [showTimelapseSettings, setShowTimelapseSettings] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Parking backend states
  const [parkingBackends, setParkingBackends] = useState<ParkingBackend[]>([]);
  const [showParkingBackendModal, setShowParkingBackendModal] = useState(false);
  const [selectedBackend, setSelectedBackend] = useState<ParkingBackend | null>(
    null
  );

  // Load cameras from backend API (reads from go2rtc.yaml)
  useEffect(() => {
    const loadCameras = async () => {
      try {
        const cameras = await backendApi.getCameras();
        setCameras(cameras);
      } catch (error) {
        alert(
          "Failed to connect to backend API. Make sure backend is running on port 5001."
        );
      }
      setLoading(false);
    };

    loadCameras();
  }, []);

  // Load parking backends from backend API
  useEffect(() => {
    const loadParkingBackends = async () => {
      try {
        const backends = await parkingBackendApi.getBackends();
        setParkingBackends(backends);
      } catch (error) {
        console.error("Failed to load parking backends:", error);
      }
    };

    loadParkingBackends();
  }, []);

  // Load timelapse list when tab switches to timelapse
  useEffect(() => {
    if (activeTab === "timelapse") {
      loadTimelapseList();
      loadTimelapseConfig();
    }
  }, [activeTab]);

  // Quản lý class body khi mở modal thủ công
  useEffect(() => {
    if (showTimelapseModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showTimelapseModal]);

  const loadTimelapseList = async () => {
    try {
      setLoadingTimelapse(true);
      const items = await timelapseApi.listTimelapse();
      setTimelapseList(items);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Không tải được danh sách timelapse");
    } finally {
      setLoadingTimelapse(false);
    }
  };

  const loadTimelapseConfig = async () => {
    try {
      const config = await timelapseApi.getConfig();
      setTimelapseConfig(config);
      setPeriodValue(config.periodValue || 1);
      setPeriodUnit(config.periodUnit || "month");
      if (config.intervalSeconds % 3600 === 0) {
        setAutoIntervalUnit("hours");
        setAutoIntervalValue(config.intervalSeconds / 3600);
      } else if (config.intervalSeconds % 60 === 0) {
        setAutoIntervalUnit("minutes");
        setAutoIntervalValue(config.intervalSeconds / 60);
      } else {
        setAutoIntervalUnit("seconds");
        setAutoIntervalValue(config.intervalSeconds);
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Không tải được cấu hình timelapse");
    }
  };

  const handleSaveTimelapseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelapseConfig) return;
    if (!autoIntervalValue || autoIntervalValue <= 0) {
      alert("Khoảng thời gian chụp phải > 0 giây.");
      return;
    }

    const multiplier =
      autoIntervalUnit === "hours"
        ? 3600
        : autoIntervalUnit === "minutes"
        ? 60
        : 1;
    const intervalSeconds = autoIntervalValue * multiplier;

    try {
      setSavingTimelapseConfig(true);
      const updated = await timelapseApi.updateConfig({
        intervalSeconds,
        periodValue,
        periodUnit,
        enabledCameraIds: timelapseConfig.enabledCameraIds,
      });
      setTimelapseConfig(updated);
      setShowTimelapseSettings(false);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Không lưu được cài đặt timelapse tự động");
    } finally {
      setSavingTimelapseConfig(false);
    }
  };

  const handleAddCamera = async (camera: Camera) => {
    try {
      // Backend will:
      // 1. Save to YAML file (persistent across restarts)
      // 2. Add to go2rtc runtime (immediate, no restart needed)
      await backendApi.addCamera(camera);

      // Update UI immediately
      setCameras((prev) => [...prev, camera]);
    } catch (error) {
      alert("Failed to add camera. Please check the backend is running.");
    }
  };

  const handleEditCamera = (camera: Camera) => {
    setEditingCamera(camera);
    setShowEditModal(true);
    // Đóng CameraModal khi mở EditModal
    setShowCameraModal(false);
  };

  const handleUpdateCamera = async (updatedCamera: Camera) => {
    try {
      if (!editingCamera) return;

      const result = await backendApi.updateCamera(
        updatedCamera,
        editingCamera.id
      );

      setCameras((prev) => {
        // Remove old camera if ID changed
        const filtered = prev.filter((cam) => cam.id !== editingCamera.id);
        // Add updated camera with new ID
        return [...filtered, result];
      });

      setShowEditModal(false);
      setEditingCamera(null);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update camera. Please check the backend is running."
      );
    }
  };

  const handleRemoveCamera = async (cameraId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this camera?"
    );
    if (!confirmed) return;

    try {
      // Backend will:
      // 1. Remove from YAML file (persistent)
      // 2. Remove from go2rtc runtime (immediate)
      await backendApi.removeCamera(cameraId);

      setCameras((prev) => prev.filter((cam) => cam.id !== cameraId));
    } catch (error) {
      alert("Failed to remove camera. Please check the backend is running.");
    }
  };

  // Parking backend handlers
  const handleAddParkingBackend = async (backend: ParkingBackend) => {
    try {
      const newBackend = await parkingBackendApi.addBackend(backend);
      setParkingBackends((prev) => [...prev, newBackend]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to add backend. Please check the backend is running."
      );
    }
  };

  const handleRemoveParkingBackend = async (backendId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this parking backend?"
    );
    if (!confirmed) return;

    try {
      await parkingBackendApi.removeBackend(backendId);
      setParkingBackends((prev) => prev.filter((b) => b.id !== backendId));
    } catch (err) {
      alert("Failed to remove backend. Please check the backend is running.");
    }
  };

  const handleCreateTimelapse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelapseInterval || timelapseInterval <= 0) {
      alert("Khoảng thời gian phải lớn hơn 0 giây.");
      return;
    }

    const multiplier =
      timelapseUnit === "hours" ? 3600 : timelapseUnit === "minutes" ? 60 : 1;
    const intervalSeconds = timelapseInterval * multiplier;
    if (!intervalSeconds || intervalSeconds <= 0) {
      alert("Khoảng thời gian không hợp lệ.");
      return;
    }

    const source = timelapseSource.trim() || undefined;
    const fileToSend = timelapseFile;

    if (!source && !fileToSend) {
      alert("Vui lòng nhập nguồn video hoặc chọn file video.");
      return;
    }

    try {
      setCreatingTimelapse(true);
      const result = await timelapseApi.createTimelapse({
        source,
        intervalSeconds,
        file: fileToSend,
      });
      setTimelapseVideoUrl(`${result.videoUrl}`);
      loadTimelapseList();
      setTimelapseFile(null);
      const fileInput = document.getElementById(
        "timelapse-file"
      ) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error: any) {
      alert(error?.message || "Tạo timelapse thất bại.");
    } finally {
      setCreatingTimelapse(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="d-flex h-100 bg-dark app-container"
      style={{ height: "100vh", overflow: "hidden", width: "100vw" }}
    >
      {/* Sidebar - Offcanvas Bootstrap */}
      <div
        className={`offcanvas offcanvas-start bg-dark text-white ${
          showSidebar ? "show" : ""
        }`}
        tabIndex={-1}
        id="sidebar-offcanvas"
      >
        <div className="offcanvas-header border-bottom border-secondary">
          <h5 className="offcanvas-title">Menu</h5>
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={() => setShowSidebar(false)}
          ></button>
        </div>
        <div className="offcanvas-body">
          {/* Tabs */}
          <ul className="nav nav-pills flex-column gap-2">
            <li className="nav-item">
              <button
                className={`nav-link w-100 text-start ${
                  activeTab === "camera" ? "active bg-primary" : "text-white-50"
                }`}
                onClick={() => {
                  setActiveTab("camera");
                  setShowSidebar(false);
                }}
              >
                <i className="bi bi-camera-video me-2"></i>
                Camera
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link w-100 text-start ${
                  activeTab === "timelapse"
                    ? "active bg-primary"
                    : "text-white-50"
                }`}
                onClick={() => {
                  setActiveTab("timelapse");
                  setShowSidebar(false);
                }}
              >
                <i className="bi bi-clock-history me-2"></i>
                Timelapse
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link w-100 text-start ${
                  activeTab === "parking"
                    ? "active bg-primary"
                    : "text-white-50"
                }`}
                onClick={() => {
                  setActiveTab("parking");
                  setShowSidebar(false);
                }}
              >
                <i className="bi bi-lock me-2"></i>
                Parking Locker
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link w-100 text-start ${
                  activeTab === "camera-ai"
                    ? "active bg-primary"
                    : "text-white-50"
                }`}
                onClick={() => {
                  setActiveTab("camera-ai");
                  setShowSidebar(false);
                }}
              >
                <i className="bi bi-cpu me-2"></i>
                Camera AI
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div
        className={`offcanvas-backdrop fade ${showSidebar ? "show" : ""}`}
        onClick={() => setShowSidebar(false)}
      ></div>

      {/* Main Content */}
      <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
        {/* Header - Fixed Height */}
        <nav
          className="navbar navbar-dark bg-black border-bottom border-secondary flex-shrink-0"
          style={{ minHeight: "56px", maxHeight: "56px" }}
        >
          <div
            style={{
              width: "100%",
              padding: "0 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              className="btn btn-outline-light"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <i className="bi bi-list"></i>
            </button>
            <div className="d-flex gap-2">
              {activeTab === "timelapse" && (
                <button
                  className="btn btn-outline-light"
                  onClick={() => setShowTimelapseSettings(true)}
                >
                  <i className="bi bi-gear me-2"></i>
                  Cài đặt timelapse
                </button>
              )}
              {activeTab === "camera" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowModal(true)}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Add Camera
                </button>
              )}
              {activeTab === "parking" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowParkingBackendModal(true)}
                >
                  <i className="bi bi-gear me-2"></i>
                  Manage Backends
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content - Flexible, No Overflow */}
        <div
          className="flex-grow-1 d-flex flex-column overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {activeTab === "camera" ? (
            <CameraGrid
              cameras={cameras}
              onRemoveCamera={handleRemoveCamera}
              onEditCamera={handleEditCamera}
              onCameraClick={(camera) => {
                setSelectedCamera(camera);
                setShowCameraModal(true);
              }}
            />
          ) : activeTab === "parking" ? (
            <div className="p-3 h-100" style={{ overflowY: "auto" }}>
              {parkingBackends.length === 0 ? (
                <div className="d-flex align-items-center justify-content-center h-100">
                  <div className="text-center">
                    <i className="bi bi-hdd-network fs-1 text-white-50 mb-3 d-block"></i>
                    <h3 className="text-white-50">No Parking Backends</h3>
                    <p className="text-secondary">
                      Click "Manage Backends" to add parking lot backend servers
                    </p>
                  </div>
                </div>
              ) : (
                <div className="row g-3">
                  {parkingBackends.map((backend) => {
                    const active = selectedBackend?.id === backend.id;
                    return (
                      <div key={backend.id} className="col-12 col-md-6 col-lg-4">
                        <div
                          className={`card bg-dark text-white border-secondary h-100 ${
                            active ? "border-primary" : ""
                          }`}
                        >
                          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                            <div>
                              <h5 className="card-title mb-0">{backend.name}</h5>
                              <small className="text-secondary">{backend.id}</small>
                            </div>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-outline-light"
                                onClick={() => setSelectedBackend(backend)}
                                title="Chọn khu này"
                              >
                                <i className="bi bi-box-arrow-in-right"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() =>
                                  handleRemoveParkingBackend(backend.id)
                                }
                                title="Remove backend"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                          <div className="card-body">
                            <p className="mb-2">
                              <i className="bi bi-hdd-network me-2"></i>
                              <strong>Host:</strong> {backend.host}
                            </p>
                            <p className="mb-2">
                              <i className="bi bi-plug me-2"></i>
                              <strong>Port:</strong> {backend.port}
                            </p>
                            <p className="mb-2">
                              <i className="bi bi-link-45deg me-2"></i>
                              <strong>URL:</strong>{" "}
                              <code className="text-info">
                                http://{backend.host}:{backend.port}
                              </code>
                            </p>
                            {backend.description && (
                              <p className="mb-0 text-secondary">
                                <i className="bi bi-info-circle me-2"></i>
                                {backend.description}
                              </p>
                            )}
                          </div>
                          <div className="card-footer border-secondary d-flex justify-content-between align-items-center">
                            <span
                              className={`badge ${
                                backend.enabled ? "bg-success" : "bg-secondary"
                              }`}
                            >
                              {backend.enabled ? "Enabled" : "Disabled"}
                            </span>
                            {active && (
                              <span className="badge bg-primary">Đang chọn</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3">
                {selectedBackend ? (
                  <ParkingLockerApp backend={selectedBackend} />
                ) : (
                  <div className="alert alert-secondary mb-0">
                    Hãy chọn một backend (khu) để điều khiển locker.
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "timelapse" ? (
            <div
              className="row h-100"
              style={{ minHeight: 0, overflow: "hidden" }}
            >
              <div
                className="col-12 col-lg-4 d-flex flex-column"
                style={{ minHeight: 0 }}
              >
                <div
                  className="card bg-black text-white border-secondary mb-2 h-100 d-flex flex-column"
                  style={{ minHeight: 0 }}
                >
                  <div className="card-header border-secondary flex-shrink-0">
                    <i className="bi bi-clock-history me-2"></i>
                    Tạo timelapse
                  </div>
                  <div
                    className="card-body flex-grow-1"
                    style={{ overflowY: "auto", minHeight: 0 }}
                  >
                    <form
                      className="d-flex flex-column gap-3 h-100"
                      onSubmit={handleCreateTimelapse}
                    >
                      <div>
                        <label className="form-label">
                          Nguồn video (MP4/RTSP/URL)
                        </label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="http://... hoặc rtsp://..."
                          value={timelapseSource}
                          onChange={(e) => setTimelapseSource(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Hoặc chọn file video (MP4)
                        </label>
                        <input
                          id="timelapse-file"
                          type="file"
                          accept="video/*"
                          className="form-control bg-dark text-white border-secondary"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setTimelapseFile(file);
                          }}
                        />
                      </div>
                      <div>
                        <label className="form-label">Cắt ảnh mỗi</label>
                        <div className="input-group">
                          <input
                            type="number"
                            min={1}
                            className="form-control bg-dark text-white border-secondary"
                            value={timelapseInterval}
                            onChange={(e) =>
                              setTimelapseInterval(Number(e.target.value))
                            }
                          />
                          <select
                            className="form-select bg-dark text-white border-secondary"
                            value={timelapseUnit}
                            onChange={(e) =>
                              setTimelapseUnit(
                                e.target.value as
                                  | "seconds"
                                  | "minutes"
                                  | "hours"
                              )
                            }
                          >
                            <option value="seconds">Giây</option>
                            <option value="minutes">Phút</option>
                            <option value="hours">Giờ</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingTimelapse}
                      >
                        {creatingTimelapse ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-plus-circle me-2"></i>
                            Add Timelapse
                          </>
                        )}
                      </button>
                      <small className="text-secondary">
                        Backend sẽ dùng ffmpeg: trích ảnh theo chu kỳ và ghép
                        lại thành video.
                      </small>
                    </form>
                  </div>
                </div>
              </div>

              <div
                className="col-12 col-lg-8 d-flex flex-column"
                style={{ minHeight: 0 }}
              >
                <div className="card bg-black text-white border-secondary mb-2 flex-shrink-0">
                  <div className="card-header border-secondary">
                    <i className="bi bi-play-circle me-2"></i>
                    Kết quả timelapse
                  </div>
                  <div className="card-body">
                    {timelapseVideoUrl ? (
                      <video
                        controls
                        className="w-100"
                        src={`http://localhost:5001${timelapseVideoUrl}`}
                        style={{ maxHeight: "200px" }}
                      />
                    ) : (
                      <div className="alert alert-secondary text-center mb-0">
                        Chưa có video timelapse. Hãy nhập nguồn và thời gian rồi
                        nhấn "Add Timelapse".
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className="card bg-black text-white border-secondary flex-grow-1 d-flex flex-column"
                  style={{ minHeight: 0 }}
                >
                  <div className="card-header border-secondary d-flex justify-content-between align-items-center flex-shrink-0">
                    <div>
                      <i className="bi bi-collection-play me-2"></i>
                      Danh sách timelapse
                    </div>
                    <button
                      className="btn btn-sm btn-outline-light"
                      onClick={loadTimelapseList}
                      disabled={loadingTimelapse}
                    >
                      {loadingTimelapse ? (
                        <span className="spinner-border spinner-border-sm"></span>
                      ) : (
                        <i className="bi bi-arrow-clockwise"></i>
                      )}
                    </button>
                  </div>
                  <div
                    className="card-body flex-grow-1"
                    style={{ overflowY: "auto", minHeight: 0 }}
                  >
                    {loadingTimelapse ? (
                      <div className="text-center text-secondary">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Đang tải danh sách...
                      </div>
                    ) : timelapseList.length === 0 ? (
                      <div className="alert alert-secondary text-center mb-0">
                        Chưa có timelapse nào.
                      </div>
                    ) : (
                      <div className="list-group">
                        {timelapseList.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="list-group-item list-group-item-action bg-dark text-white border-secondary d-flex justify-content-between align-items-center"
                            onClick={() => {
                              setSelectedTimelapse(item);
                              setShowTimelapseModal(true);
                            }}
                          >
                            <div>
                              <div className="fw-semibold">{item.id}</div>
                              {item.createdAt ? (
                                <small className="text-secondary">
                                  {new Date(item.createdAt).toLocaleString()}
                                </small>
                              ) : null}
                            </div>
                            <i className="bi bi-play-circle"></i>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "camera-ai" ? (
            <CameraAI />
          ) : null}
        </div>
      </div>

      {/* Timelapse modal preview */}
      {showTimelapseModal && selectedTimelapse && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content bg-black text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">
                    <i className="bi bi-camera-reels me-2"></i>
                    {selectedTimelapse.id}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowTimelapseModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <video
                    controls
                    className="w-100"
                    src={`http://localhost:5001${selectedTimelapse.videoUrl}`}
                  />
                </div>
                <div className="modal-footer border-secondary">
                  {selectedTimelapse.createdAt ? (
                    <small className="text-secondary me-auto">
                      Tạo lúc:{" "}
                      {new Date(selectedTimelapse.createdAt).toLocaleString()}
                    </small>
                  ) : (
                    <span className="me-auto"></span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowTimelapseModal(false)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setShowTimelapseModal(false)}
          ></div>
        </>
      )}

      {/* Timelapse settings modal */}
      {showTimelapseSettings && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content bg-black text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">
                    <i className="bi bi-gear me-2"></i>
                    Cài đặt timelapse tự động cho camera
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowTimelapseSettings(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {timelapseConfig ? (
                    <form
                      className="d-flex flex-column gap-3"
                      onSubmit={handleSaveTimelapseConfig}
                    >
                      <div>
                        <label className="form-label">
                          Chu kỳ tạo video timelapse
                        </label>
                        <div className="input-group">
                          <input
                            type="number"
                            min={1}
                            className="form-control bg-dark text-white border-secondary"
                            value={periodValue}
                            onChange={(e) =>
                              setPeriodValue(Number(e.target.value))
                            }
                          />
                          <select
                            className="form-select bg-dark text-white border-secondary"
                            value={periodUnit}
                            onChange={(e) =>
                              setPeriodUnit(
                                e.target.value as
                                  | "hour"
                                  | "day"
                                  | "month"
                                  | "year"
                              )
                            }
                          >
                            <option value="hour">Giờ</option>
                            <option value="day">Ngày</option>
                            <option value="month">Tháng</option>
                            <option value="year">Năm</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="form-label">
                          Tần suất chụp (mỗi)
                        </label>
                        <div className="input-group">
                          <input
                            type="number"
                            min={1}
                            className="form-control bg-dark text-white border-secondary"
                            value={autoIntervalValue}
                            onChange={(e) =>
                              setAutoIntervalValue(Number(e.target.value))
                            }
                          />
                          <select
                            className="form-select bg-dark text-white border-secondary"
                            value={autoIntervalUnit}
                            onChange={(e) =>
                              setAutoIntervalUnit(
                                e.target.value as
                                  | "seconds"
                                  | "minutes"
                                  | "hours"
                              )
                            }
                          >
                            <option value="seconds">Giây</option>
                            <option value="minutes">Phút</option>
                            <option value="hours">Giờ</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="form-label">
                          Chọn camera bật timelapse tự động
                        </label>
                        <div className="list-group">
                          {cameras.map((cam) => {
                            const checked =
                              timelapseConfig.enabledCameraIds.includes(cam.id);
                            return (
                              <label
                                key={cam.id}
                                className="list-group-item bg-dark text-white border-secondary d-flex align-items-center justify-content-between"
                              >
                                <div>
                                  <div className="fw-semibold">{cam.name}</div>
                                  <small className="text-secondary">
                                    {cam.id}
                                  </small>
                                </div>
                                <input
                                  type="checkbox"
                                  className="form-check-input ms-2"
                                  checked={checked}
                                  onChange={() =>
                                    setTimelapseConfig((prev) => {
                                      if (!prev) return prev;
                                      const enabled =
                                        prev.enabledCameraIds.includes(cam.id);
                                      return {
                                        ...prev,
                                        enabledCameraIds: enabled
                                          ? prev.enabledCameraIds.filter(
                                              (id) => id !== cam.id
                                            )
                                          : [...prev.enabledCameraIds, cam.id],
                                      };
                                    })
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-outline-primary"
                        disabled={savingTimelapseConfig}
                      >
                        {savingTimelapseConfig ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-save me-2"></i>
                            Lưu cài đặt
                          </>
                        )}
                      </button>
                      <small className="text-secondary">
                        Hệ thống sẽ tự chụp ảnh từ stream các camera đã bật theo
                        tần suất, và mỗi tháng tự động ghép thành 1 video
                        timelapse / camera.
                      </small>
                    </form>
                  ) : (
                    <div className="text-center text-secondary">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Đang tải cấu hình timelapse...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setShowTimelapseSettings(false)}
          ></div>
        </>
      )}

      {/* Add Camera Modal */}
      <AddCameraModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onAdd={handleAddCamera}
      />

      {/* Edit Camera Modal */}
      <EditCameraModal
        show={showEditModal}
        camera={editingCamera}
        onClose={() => {
          setShowEditModal(false);
          setEditingCamera(null);
        }}
        onUpdate={handleUpdateCamera}
        onRemove={handleRemoveCamera}
      />

      {/* Camera Modal - High Quality View */}
      <CameraModal
        camera={selectedCamera}
        show={showCameraModal}
        onClose={() => {
          setShowCameraModal(false);
          setSelectedCamera(null);
        }}
        onEdit={(camera) => {
          handleEditCamera(camera);
          // Không đóng CameraModal ngay, để EditModal mở trước
          // CameraModal sẽ tự đóng khi EditModal mở thành công
        }}
      />

      {/* Add Parking Backend Modal */}
      <AddParkingBackendModal
        show={showParkingBackendModal}
        onClose={() => setShowParkingBackendModal(false)}
        onAdd={handleAddParkingBackend}
      />
    </div>
  );
}

export default App;
