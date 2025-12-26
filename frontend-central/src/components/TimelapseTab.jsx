import { useState, useEffect } from 'react';

const TimelapseTab = ({ showSettings, onCloseSettings }) => {
  const [timelapseSource, setTimelapseSource] = useState('');
  const [timelapseInterval, setTimelapseInterval] = useState(5);
  const [timelapseUnit, setTimelapseUnit] = useState('seconds');
  const [timelapseFile, setTimelapseFile] = useState(null);
  const [creatingTimelapse, setCreatingTimelapse] = useState(false);
  const [timelapseList, setTimelapseList] = useState([]);
  const [loadingTimelapse, setLoadingTimelapse] = useState(false);
  const [showTimelapseModal, setShowTimelapseModal] = useState(false);
  const [selectedTimelapse, setSelectedTimelapse] = useState(null);
  const [timelapseConfig, setTimelapseConfig] = useState(null);
  const [savingTimelapseConfig, setSavingTimelapseConfig] = useState(false);
  const [autoIntervalValue, setAutoIntervalValue] = useState(600);
  const [autoIntervalUnit, setAutoIntervalUnit] = useState('seconds');
  const [periodValue, setPeriodValue] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('month');
  const [cameras, setCameras] = useState([]);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    loadTimelapseList();
    loadTimelapseConfig();
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
    }
  };

  useEffect(() => {
    if (showTimelapseModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showTimelapseModal]);

  const loadTimelapseList = async () => {
    try {
      setLoadingTimelapse(true);
      const response = await fetch(`${BACKEND_URL}/api/timelapse`);
      if (!response.ok) throw new Error('Failed to fetch timelapse list');
      const result = await response.json();
      const data = result.data || result;
      setTimelapseList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading timelapse:', error);
    } finally {
      setLoadingTimelapse(false);
    }
  };

  const loadTimelapseConfig = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/timelapse/config`);
      if (!response.ok) throw new Error('Failed to fetch config');
      const result = await response.json();
      const config = result.data || result;
      setTimelapseConfig(config);
      setPeriodValue(config.periodValue || 1);
      setPeriodUnit(config.periodUnit || 'month');
      if (config.intervalSeconds % 3600 === 0) {
        setAutoIntervalUnit('hours');
        setAutoIntervalValue(config.intervalSeconds / 3600);
      } else if (config.intervalSeconds % 60 === 0) {
        setAutoIntervalUnit('minutes');
        setAutoIntervalValue(config.intervalSeconds / 60);
      } else {
        setAutoIntervalUnit('seconds');
        setAutoIntervalValue(config.intervalSeconds);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleCreateTimelapse = async (e) => {
    e.preventDefault();
    if (!timelapseInterval || timelapseInterval <= 0) {
      alert('Khoảng thời gian phải lớn hơn 0 giây.');
      return;
    }

    const multiplier = timelapseUnit === 'hours' ? 3600 : timelapseUnit === 'minutes' ? 60 : 1;
    const intervalSeconds = timelapseInterval * multiplier;

    const source = timelapseSource.trim() || undefined;
    const fileToSend = timelapseFile;

    if (!source && !fileToSend) {
      alert('Vui lòng nhập nguồn video hoặc chọn file video.');
      return;
    }

    try {
      setCreatingTimelapse(true);
      const formData = new FormData();
      if (source) formData.append('source', source);
      if (fileToSend) formData.append('file', fileToSend);
      formData.append('intervalSeconds', intervalSeconds.toString());

      const response = await fetch(`${BACKEND_URL}/api/timelapse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create timelapse');

      loadTimelapseList();
      setTimelapseFile(null);
      const fileInput = document.getElementById('timelapse-file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      alert(error.message || 'Không tạo được timelapse');
    } finally {
      setCreatingTimelapse(false);
    }
  };

  const handleSaveTimelapseConfig = async (e) => {
    e.preventDefault();
    if (!timelapseConfig) return;
    if (!autoIntervalValue || autoIntervalValue <= 0) {
      alert('Khoảng thời gian chụp phải > 0 giây.');
      return;
    }

    const multiplier = autoIntervalUnit === 'hours' ? 3600 : autoIntervalUnit === 'minutes' ? 60 : 1;
    const intervalSeconds = autoIntervalValue * multiplier;

    try {
      setSavingTimelapseConfig(true);
      const response = await fetch(`${BACKEND_URL}/api/timelapse/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalSeconds,
          periodValue,
          periodUnit,
          enabledCameraIds: timelapseConfig.enabledCameraIds || [],
        }),
      });

      if (!response.ok) throw new Error('Failed to save config');
      const result = await response.json();
      const updated = result.data || result;
      setTimelapseConfig(updated);
      onCloseSettings();
    } catch (error) {
      alert(error?.message || 'Không lưu được cài đặt timelapse tự động');
    } finally {
      setSavingTimelapseConfig(false);
    }
  };

  return (
    <div className="row h-100" style={{ minHeight: 0, overflow: 'hidden' }}>
      {/* Left Column - Create Timelapse */}
      <div className="col-12 col-lg-4 border-end border-secondary" style={{ overflowY: 'auto', maxHeight: '100%' }}>
        <div className="p-3">
          <h5 className="text-white mb-3">
            <i className="bi bi-plus-circle me-2"></i>
            Tạo Timelapse
          </h5>
          <form className="d-flex flex-column gap-3" onSubmit={handleCreateTimelapse}>
            <div>
              <label className="form-label">Nguồn video (MP4/RTSP/URL)</label>
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder="rtsp://... hoặc http://..."
                value={timelapseSource}
                onChange={(e) => setTimelapseSource(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Hoặc chọn file video (MP4)</label>
              <input
                type="file"
                id="timelapse-file"
                className="form-control bg-dark text-white border-secondary"
                accept="video/mp4"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setTimelapseFile(file);
                }}
              />
            </div>
            <div>
              <label className="form-label">Cắt ảnh mỗi</label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control bg-dark text-white border-secondary"
                  min="1"
                  value={timelapseInterval}
                  onChange={(e) => setTimelapseInterval(Number(e.target.value))}
                />
                <select
                  className="form-select bg-dark text-white border-secondary"
                  value={timelapseUnit}
                  onChange={(e) => setTimelapseUnit(e.target.value)}
                >
                  <option value="seconds">Giây</option>
                  <option value="minutes">Phút</option>
                  <option value="hours">Giờ</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creatingTimelapse}>
              {creatingTimelapse ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <i className="bi bi-film me-2"></i>
                  Add Timelapse
                </>
              )}
            </button>
            <small className="text-secondary">
              Backend sẽ dùng ffmpeg: trích ảnh theo chu kỳ và ghép lại thành video.
            </small>
          </form>
        </div>
      </div>

      {/* Right Column - Timelapse List */}
      <div className="col-12 col-lg-8" style={{ overflowY: 'auto', maxHeight: '100%' }}>
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="text-white mb-0">
              <i className="bi bi-collection-play me-2"></i>
              Danh sách Timelapse
            </h5>
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

          <div className="list-group">
            {loadingTimelapse ? (
              <div className="text-center text-secondary">
                <span className="spinner-border spinner-border-sm me-2"></span>
                Đang tải danh sách...
              </div>
            ) : timelapseList.length === 0 ? (
              <div className="text-center text-secondary p-5">
                <i className="bi bi-film fs-1 d-block mb-3"></i>
                <p>Chưa có timelapse nào. Hãy tạo timelapse đầu tiên bằng form bên trái.</p>
              </div>
            ) : (
              timelapseList.map((item) => (
                <button
                  key={item.id}
                  className="list-group-item list-group-item-action bg-dark text-white border-secondary d-flex justify-content-between align-items-center"
                  onClick={() => {
                    setSelectedTimelapse(item);
                    setShowTimelapseModal(true);
                  }}
                >
                  <div>
                    <div className="fw-semibold">{item.id}</div>
                    {item.createdAt && (
                      <small className="text-secondary">
                        Tạo lúc: {new Date(item.createdAt).toLocaleString()}
                      </small>
                    )}
                  </div>
                  <i className="bi bi-play-circle fs-4"></i>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Timelapse Preview Modal */}
      {showTimelapseModal && selectedTimelapse && (
        <>
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content bg-dark text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">{selectedTimelapse.id}</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowTimelapseModal(false)}></button>
                </div>
                <div className="modal-body">
                  <video
                    controls
                    className="w-100"
                    src={`${BACKEND_URL}${selectedTimelapse.videoUrl}`}
                  />
                </div>
                <div className="modal-footer border-secondary">
                  {selectedTimelapse.createdAt && (
                    <small className="text-secondary me-auto">
                      Tạo lúc: {new Date(selectedTimelapse.createdAt).toLocaleString()}
                    </small>
                  )}
                  <button className="btn btn-secondary" onClick={() => setShowTimelapseModal(false)}>
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowTimelapseModal(false)}></div>
        </>
      )}

      {/* Timelapse Settings Modal */}
      {showSettings && (
        <>
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content bg-dark text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">Cài đặt Timelapse tự động</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={onCloseSettings}></button>
                </div>
                <div className="modal-body">
                  {timelapseConfig ? (
                    <form className="d-flex flex-column gap-3" onSubmit={handleSaveTimelapseConfig}>
                      <div>
                        <label className="form-label">Chu kỳ tạo video timelapse</label>
                        <div className="input-group mb-2">
                          <input
                            type="number"
                            className="form-control bg-dark text-white border-secondary"
                            min="1"
                            value={periodValue}
                            onChange={(e) => setPeriodValue(Number(e.target.value))}
                          />
                          <select
                            className="form-select bg-dark text-white border-secondary"
                            value={periodUnit}
                            onChange={(e) => setPeriodUnit(e.target.value)}
                          >
                            <option value="hour">Giờ</option>
                            <option value="day">Ngày</option>
                            <option value="month">Tháng</option>
                            <option value="year">Năm</option>
                          </select>
                        </div>
                        <small className="text-secondary">
                          Mỗi {periodValue} {periodUnit === 'hour' ? 'giờ' : periodUnit === 'day' ? 'ngày' : periodUnit === 'month' ? 'tháng' : 'năm'} sẽ tạo 1 video timelapse
                        </small>
                      </div>

                      <div>
                        <label className="form-label">Khoảng thời gian giữa các lần chụp</label>
                        <div className="input-group">
                          <input
                            type="number"
                            className="form-control bg-dark text-white border-secondary"
                            min="1"
                            value={autoIntervalValue}
                            onChange={(e) => setAutoIntervalValue(Number(e.target.value))}
                          />
                          <select
                            className="form-select bg-dark text-white border-secondary"
                            value={autoIntervalUnit}
                            onChange={(e) => setAutoIntervalUnit(e.target.value)}
                          >
                            <option value="seconds">Giây</option>
                            <option value="minutes">Phút</option>
                            <option value="hours">Giờ</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Chọn cameras tự động chụp</label>
                        {cameras.length === 0 ? (
                          <div className="text-secondary">
                            <small>Chưa có camera nào. Vui lòng thêm camera ở tab Camera RTSP.</small>
                          </div>
                        ) : (
                          <div className="list-group">
                            {cameras.map((cam) => {
                              const isEnabled = timelapseConfig.enabledCameraIds?.includes(cam.id);
                              return (
                                <label
                                  key={cam.id}
                                  className="list-group-item list-group-item-action bg-dark text-white border-secondary d-flex justify-content-between align-items-center"
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div>
                                    <div className="fw-semibold">{cam.name}</div>
                                    <small className="text-secondary">{cam.id}</small>
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={isEnabled}
                                    onChange={(e) => {
                                      setTimelapseConfig((prev) => {
                                        if (!prev) return prev;
                                        const enabled = prev.enabledCameraIds?.includes(cam.id);
                                        return {
                                          ...prev,
                                          enabledCameraIds: enabled
                                            ? prev.enabledCameraIds.filter((id) => id !== cam.id)
                                            : [...(prev.enabledCameraIds || []), cam.id],
                                        };
                                      });
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={savingTimelapseConfig}>
                        {savingTimelapseConfig ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Đang lưu...
                          </>
                        ) : (
                          'Lưu cài đặt'
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center">
                      <span className="spinner-border"></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={onCloseSettings}></div>
        </>
      )}
    </div>
  );
};

export default TimelapseTab;
