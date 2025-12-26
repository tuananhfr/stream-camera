import { useEffect, useMemo, useState } from "react";
import type { ParkingBackend } from "../types/parkingBackend";
import type { Locker } from "../types/locker";
import { createParkingLockerApi } from "../services/parkingLockerApi";

type Props = {
  backend: ParkingBackend;
};

export function ParkingLockerApp({ backend }: Props) {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState<string | null>(null);
  const [configLocker, setConfigLocker] = useState<string | null>(null);
  const [configData, setConfigData] = useState({
    upProtect: "",
    downProtect: "",
    freeTime: "",
    warningTime: "",
  });

  const api = useMemo(() => {
    const baseURL = `http://${backend.host}:${backend.port}`;
    return createParkingLockerApi(baseURL);
  }, [backend.host, backend.port]);

  useEffect(() => {
    loadLockers();
  }, [api]);

  const loadLockers = async () => {
    setLoading(true);
    try {
      const data = await api.getLockers({ connected: true, limit: 100 });
      setLockers(data);
    } catch (err) {
      console.error(err);
      alert("Không tải được danh sách locker từ backend này.");
    } finally {
      setLoading(false);
    }
  };

  const handleControl = async (
    lockId: string,
    action: "open" | "close" | "stop" | "normal"
  ) => {
    if (
      !confirm(`Gửi lệnh ${action.toUpperCase()} đến locker ${lockId}?`)
    ) {
      return;
    }
    setControlling(lockId);
    try {
      await api.controlLocker(lockId, { action, mode: "normal" });
      setTimeout(loadLockers, 800);
    } catch (err) {
      console.error(err);
      alert("Gửi lệnh thất bại");
    } finally {
      setControlling(null);
    }
  };

  const handleSetAttribute = async (lockId: string) => {
    const payload: { up_protect?: number; down_protect?: number } = {};
    if (configData.upProtect) {
      const val = parseInt(configData.upProtect, 10);
      if (val < 20 || val > 95) {
        alert("UpProtect phải từ 20-95");
        return;
      }
      payload.up_protect = val;
    }
    if (configData.downProtect) {
      const val = parseInt(configData.downProtect, 10);
      if (val < 20 || val > 95) {
        alert("DownProtect phải từ 20-95");
        return;
      }
      payload.down_protect = val;
    }
    if (!payload.up_protect && !payload.down_protect) {
      alert("Nhập ít nhất một giá trị bảo vệ");
      return;
    }
    try {
      await api.setLockAttribute(lockId, payload);
      alert("Đã cập nhật bảo vệ");
      setConfigLocker(null);
      setConfigData({
        upProtect: "",
        downProtect: "",
        freeTime: "",
        warningTime: "",
      });
    } catch (err) {
      console.error(err);
      alert("Thiết lập thất bại");
    }
  };

  const handleSetFreeTime = async (lockId: string) => {
    if (!configData.freeTime) {
      alert("Nhập thời gian phút");
      return;
    }
    const time = parseInt(configData.freeTime, 10);
    if (time < 0) {
      alert("Thời gian phải >= 0");
      return;
    }
    try {
      await api.setFreeTime(lockId, { time });
      alert("Đã cập nhật free time");
      setConfigData((prev) => ({ ...prev, freeTime: "" }));
    } catch (err) {
      console.error(err);
      alert("Thiết lập free time thất bại");
    }
  };

  const handleSetWarningTime = async (lockId: string) => {
    if (!configData.warningTime) {
      alert("Nhập thời gian cảnh báo (s)");
      return;
    }
    const time = parseInt(configData.warningTime, 10);
    if (time < 0) {
      alert("Thời gian phải >= 0");
      return;
    }
    try {
      await api.setWarningTime(lockId, { time });
      alert("Đã cập nhật warning time");
      setConfigData((prev) => ({ ...prev, warningTime: "" }));
    } catch (err) {
      console.error(err);
      alert("Thiết lập warning time thất bại");
    }
  };

  return (
    <div className="card bg-black text-white border-secondary">
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
        <div>
          <i className="bi bi-lock me-2"></i>
          Parking Locker - {backend.name}{" "}
          <small className="text-secondary">({backend.id})</small>
        </div>
        <button className="btn btn-sm btn-outline-light" onClick={loadLockers}>
          <i className="bi bi-arrow-clockwise"></i>
        </button>
      </div>
      <div className="card-body bg-dark text-white">
        {loading ? (
          <div className="text-center text-secondary py-3">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Đang tải...
          </div>
        ) : lockers.length === 0 ? (
          <div className="alert alert-secondary mb-0">
            Chưa có locker (hoặc chưa kết nối) ở backend này.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Thiết bị</th>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Chế độ</th>
                  <th>Occupied</th>
                  <th>Last Action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lockers.map((locker) => (
                  <tr key={locker.lock_id}>
                    <td>
                      <strong>{locker.lock_id}</strong>
                    </td>
                    <td>{locker.device_id}</td>
                    <td>{locker.name || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          locker.status === "UP" ? "bg-success" : "bg-warning"
                        }`}
                      >
                        {locker.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-info">{locker.mode}</span>
                    </td>
                    <td>
                      {locker.occupied ? (
                        <span className="badge bg-danger">Yes</span>
                      ) : (
                        <span className="badge bg-secondary">No</span>
                      )}
                    </td>
                    <td>
                      <div className="small">
                        {locker.last_action_time || "-"}
                        {locker.last_action && (
                          <div className="text-secondary">
                            {locker.last_action}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-success"
                            onClick={() => handleControl(locker.lock_id, "open")}
                            disabled={controlling === locker.lock_id}
                          >
                            <i className="bi bi-unlock"></i>
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() =>
                              handleControl(locker.lock_id, "close")
                            }
                            disabled={controlling === locker.lock_id}
                          >
                            <i className="bi bi-lock"></i>
                          </button>
                          <button
                            className="btn btn-warning"
                            onClick={() => handleControl(locker.lock_id, "stop")}
                            disabled={controlling === locker.lock_id}
                          >
                            <i className="bi bi-stop-circle"></i>
                          </button>
                          <button
                            className="btn btn-info"
                            onClick={() =>
                              handleControl(locker.lock_id, "normal")
                            }
                            disabled={controlling === locker.lock_id}
                          >
                            <i className="bi bi-arrow-repeat"></i>
                          </button>
                        </div>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() =>
                            setConfigLocker(
                              configLocker === locker.lock_id
                                ? null
                                : locker.lock_id
                            )
                          }
                        >
                          <i className="bi bi-gear"></i>
                        </button>
                      </div>
                      {configLocker === locker.lock_id && (
                        <div className="card mt-2 p-2 bg-black border-secondary">
                          <small className="text-secondary">Cấu hình:</small>
                          <div className="row g-2">
                            <div className="col-6">
                              <input
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Up Protect (20-95)"
                                value={configData.upProtect}
                                onChange={(e) =>
                                  setConfigData((prev) => ({
                                    ...prev,
                                    upProtect: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-6">
                              <input
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Down Protect (20-95)"
                                value={configData.downProtect}
                                onChange={(e) =>
                                  setConfigData((prev) => ({
                                    ...prev,
                                    downProtect: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-12">
                              <button
                                className="btn btn-sm btn-primary w-100"
                                onClick={() => handleSetAttribute(locker.lock_id)}
                              >
                                Set Protection
                              </button>
                            </div>
                            <div className="col-6">
                              <input
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Free Time (minutes)"
                                value={configData.freeTime}
                                onChange={(e) =>
                                  setConfigData((prev) => ({
                                    ...prev,
                                    freeTime: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-6">
                              <button
                                className="btn btn-sm btn-primary w-100"
                                onClick={() => handleSetFreeTime(locker.lock_id)}
                              >
                                Set Free Time
                              </button>
                            </div>
                            <div className="col-6">
                              <input
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Warning Time (seconds)"
                                value={configData.warningTime}
                                onChange={(e) =>
                                  setConfigData((prev) => ({
                                    ...prev,
                                    warningTime: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-6">
                              <button
                                className="btn btn-sm btn-primary w-100"
                                onClick={() =>
                                  handleSetWarningTime(locker.lock_id)
                                }
                              >
                                Set Warning
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

