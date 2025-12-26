import { useState } from "react";
import useCameras from "./hooks/useCameras";
import useStats from "./hooks/useStats";
import useStaff from "./hooks/useStaff";
import Layout from "./components/layout/Layout";
import ConnectionStatus from "./components/connection/ConnectionStatus";
import CameraRTSPTab from "./components/CameraRTSPTab";
import TimelapseTab from "./components/TimelapseTab";
import ParkingTab from "./components/ParkingTab";
import HistoryModal from "./components/layout/header/HistoryModal";
import StaffDropdown from "./components/layout/header/StaffDropdown";
import SettingsModal from "./components/settings/SettingsModal";

function App() {
  const [activeTab, setActiveTab] = useState("camera-ai");
  const [showSidebar, setShowSidebar] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [showTimelapseSettings, setShowTimelapseSettings] = useState(false);
  const [showManageBackends, setShowManageBackends] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { cameras, fetchCameras } = useCameras();
  const { stats } = useStats();
  const { staff, fetchStaff, toggleStaffStatus, saveStaffChanges } = useStaff();

  const handleHistoryUpdate = () => {
    setHistoryKey((prev) => prev + 1);
  };

  const handleSaveStaffChanges = async () => {
    await saveStaffChanges();
  };

  return (
    <div
      className="d-flex h-100 bg-dark app-container"
      style={{ height: "100vh", overflow: "hidden", width: "100vw" }}
    >
      {showSidebar && (
        <>
          <div
            className="offcanvas offcanvas-start bg-dark text-white show"
            tabIndex={-1}
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
              <ul className="nav nav-pills flex-column gap-2">
                <li className="nav-item">
                  <button
                    className={`nav-link w-100 text-start ${
                      activeTab === "camera-rtsp"
                        ? "active bg-primary"
                        : "text-white-50"
                    }`}
                    onClick={() => {
                      setActiveTab("camera-rtsp");
                      setShowSidebar(false);
                    }}
                  >
                    <i className="bi bi-camera-video me-2"></i>Camera RTSP
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
                    <i className="bi bi-clock-history me-2"></i>Timelapse
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
                    <i className="bi bi-lock me-2"></i>Parking Locker
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
                    <i className="bi bi-cpu me-2"></i>Camera AI
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div
            className="offcanvas-backdrop fade show"
            onClick={() => setShowSidebar(false)}
          ></div>
        </>
      )}

      <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
        {/* Top Navbar */}
        <nav
          className="navbar navbar-dark bg-black border-bottom border-secondary flex-shrink-0 position-relative"
          style={{ minHeight: "56px" }}
        >
          <div
            style={{
              width: "100%",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <button
              className="btn btn-outline-light"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <i className="bi bi-list"></i>
            </button>

            {/* Stats - Left aligned next to menu button */}
            <div className="stats-container-left">
              <div className="d-flex text-white">
                <div className="stats-item text-center">
                  <div
                    className="fw-bold"
                    style={{ fontSize: "1rem", lineHeight: "1.2" }}
                  >
                    {stats?.entries_today || 0}
                  </div>
                  <div
                    className="text-white-50"
                    style={{ fontSize: "0.7rem", lineHeight: "1" }}
                  >
                    VÀO
                  </div>
                </div>
                <div className="stats-item text-center position-relative">
                  <div
                    className="position-absolute start-0 top-0 bottom-0"
                    style={{
                      width: "1px",
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                    }}
                  ></div>
                  <div
                    className="fw-bold"
                    style={{ fontSize: "1rem", lineHeight: "1.2" }}
                  >
                    {stats?.exits_today || 0}
                  </div>
                  <div
                    className="text-white-50"
                    style={{ fontSize: "0.7rem", lineHeight: "1" }}
                  >
                    RA
                  </div>
                </div>
                <div className="stats-item text-center position-relative">
                  <div
                    className="position-absolute start-0 top-0 bottom-0"
                    style={{
                      width: "1px",
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                    }}
                  ></div>
                  <div
                    className="fw-bold"
                    style={{ fontSize: "1rem", lineHeight: "1.2" }}
                  >
                    {stats?.vehicles_in_parking || 0}
                  </div>
                  <div
                    className="text-white-50"
                    style={{ fontSize: "0.7rem", lineHeight: "1" }}
                  >
                    Trong bãi
                  </div>
                </div>
                <div className="stats-item text-center position-relative">
                  <div
                    className="position-absolute start-0 top-0 bottom-0"
                    style={{
                      width: "1px",
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                    }}
                  ></div>
                  <div
                    className="fw-bold"
                    style={{ fontSize: "1rem", lineHeight: "1.2" }}
                  >
                    {((stats?.revenue_today || 0) / 1000).toFixed(0)}K
                  </div>
                  <div
                    className="text-white-50"
                    style={{ fontSize: "0.7rem", lineHeight: "1" }}
                  >
                    Thu
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div
              className="d-flex gap-2"
              style={{ marginLeft: "auto", flexShrink: 0 }}
            >
              {/* Tab-specific buttons first */}
              {activeTab === "camera-rtsp" && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowAddCameraModal(true)}
                >
                  <i className="bi bi-plus-circle me-2"></i>Add Camera
                </button>
              )}
              {activeTab === "timelapse" && (
                <button
                  className="btn btn-sm btn-outline-light"
                  onClick={() => setShowTimelapseSettings(true)}
                >
                  <i className="bi bi-gear me-2"></i>Cài đặt timelapse
                </button>
              )}
              {activeTab === "parking" && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowManageBackends(true)}
                >
                  <i className="bi bi-plus-circle me-2"></i>Add Backend
                </button>
              )}

              {/* Common buttons - always visible */}
              <button
                className="btn btn-sm btn-outline-light"
                onClick={() => setShowHistoryModal(true)}
              >
                <i className="bi bi-clock-history me-1"></i>Xem lịch sử
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                onClick={() => setShowStaffDropdown(!showStaffDropdown)}
              >
                <i className="bi bi-people-fill me-1"></i>Người trực
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                onClick={() => setShowSettingsModal(true)}
              >
                <i className="bi bi-gear-fill me-1"></i>Cài đặt
              </button>
            </div>
          </div>
        </nav>

        <div
          className="flex-grow-1 d-flex flex-column overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {activeTab === "camera-rtsp" ? (
            <CameraRTSPTab
              showAddModal={showAddCameraModal}
              onCloseAddModal={() => setShowAddCameraModal(false)}
            />
          ) : activeTab === "timelapse" ? (
            <TimelapseTab
              showSettings={showTimelapseSettings}
              onCloseSettings={() => setShowTimelapseSettings(false)}
            />
          ) : activeTab === "parking" ? (
            <ParkingTab
              showManageBackends={showManageBackends}
              onCloseManageBackends={() => setShowManageBackends(false)}
            />
          ) : activeTab === "camera-ai" ? (
            <Layout
              cameras={cameras}
              onHistoryUpdate={handleHistoryUpdate}
              onFetchCameras={fetchCameras}
            />
          ) : null}
        </div>
      </div>

      {/* Global Modals - Available on all tabs */}
      <HistoryModal
        show={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyKey={historyKey}
      />

      {showStaffDropdown && (
        <StaffDropdown
          staff={staff}
          onFetchStaff={fetchStaff}
          onToggleStatus={toggleStaffStatus}
          onSave={handleSaveStaffChanges}
          onClose={() => setShowStaffDropdown(false)}
        />
      )}

      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSaveSuccess={fetchCameras}
      />
    </div>
  );
}

export default App;
