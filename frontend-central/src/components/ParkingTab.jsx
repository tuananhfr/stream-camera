import { useState, useEffect } from 'react';

const ParkingTab = ({ showManageBackends, onCloseManageBackends }) => {
  const [backends, setBackends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBackend, setNewBackend] = useState({
    id: '',
    name: '',
    host: '',
    port: 8080,
    description: '',
    enabled: true,
  });
  const [showBackendDetail, setShowBackendDetail] = useState(false);
  const [selectedBackend, setSelectedBackend] = useState(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    loadBackends();
  }, []);

  const loadBackends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/parking/backends`);
      if (!response.ok) throw new Error('Failed to fetch backends');
      const result = await response.json();
      const data = result.data || result;
      setBackends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading backends:', error);
      alert('Failed to load parking backends');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBackend = async (e) => {
    e.preventDefault();
    if (!newBackend.id || !newBackend.name || !newBackend.host || !newBackend.port) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/parking/backends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBackend),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add backend');
      }

      setNewBackend({
        id: '',
        name: '',
        host: '',
        port: 8080,
        description: '',
        enabled: true,
      });
      onCloseManageBackends();
      loadBackends();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteBackend = async (backendId) => {
    if (!confirm('Delete this parking backend?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/parking/backends/${backendId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete backend');
      loadBackends();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleToggleBackend = async (backend) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/parking/backends/${backend.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !backend.enabled }),
      });

      if (!response.ok) throw new Error('Failed to update backend');
      loadBackends();
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-100" style={{ overflow: 'auto' }}>
      <div className="p-4">
        <div className="row">
          <div className="col-12">
            <h4 className="text-white mb-4">
              <i className="bi bi-hdd-network me-2"></i>
              Parking Backend Servers
            </h4>

            {backends.length === 0 ? (
              <div className="card bg-dark border-secondary text-white">
                <div className="card-body text-center py-5">
                  <i className="bi bi-hdd-network" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <p className="mt-3 text-secondary">No parking backends configured.</p>
                  <p className="text-secondary">Click "Manage Backends" to add a backend server.</p>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {backends.map((backend) => (
                  <div key={backend.id} className="col-12 col-md-6 col-lg-4">
                    <div
                      className="card bg-dark border-secondary text-white h-100"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedBackend(backend);
                        setShowBackendDetail(true);
                      }}
                    >
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">{backend.name}</h6>
                        <div className="form-check form-switch" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={backend.enabled}
                            onChange={() => handleToggleBackend(backend)}
                            title={backend.enabled ? 'Disable' : 'Enable'}
                          />
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="mb-2">
                          <small className="text-secondary">Host:</small>
                          <div className="text-white">{backend.host}:{backend.port}</div>
                        </div>
                        <div className="mb-2">
                          <small className="text-secondary">ID:</small>
                          <div className="text-white font-monospace" style={{ fontSize: '0.85rem' }}>
                            {backend.id}
                          </div>
                        </div>
                        {backend.description && (
                          <div className="mb-2">
                            <small className="text-secondary">Description:</small>
                            <div className="text-white text-truncate">{backend.description}</div>
                          </div>
                        )}
                        <div className="mt-3">
                          <span
                            className={`badge ${backend.enabled ? 'bg-success' : 'bg-secondary'}`}
                          >
                            {backend.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Backend Modal */}
      {showManageBackends && (
        <>
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">
                    <i className="bi bi-plus-circle me-2"></i>Add Parking Backend
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={onCloseManageBackends}
                  ></button>
                </div>
                <form onSubmit={handleAddBackend}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">
                        Backend ID <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        placeholder="backend_1"
                        value={newBackend.id}
                        onChange={(e) => setNewBackend({ ...newBackend, id: e.target.value })}
                        required
                      />
                      <small className="text-secondary">Unique identifier for this backend</small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        placeholder="Main Parking Server"
                        value={newBackend.name}
                        onChange={(e) => setNewBackend({ ...newBackend, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="row">
                      <div className="col-8 mb-3">
                        <label className="form-label">
                          Host <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="192.168.1.100"
                          value={newBackend.host}
                          onChange={(e) => setNewBackend({ ...newBackend, host: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-4 mb-3">
                        <label className="form-label">
                          Port <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number"
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="8080"
                          min="1"
                          max="65535"
                          value={newBackend.port}
                          onChange={(e) =>
                            setNewBackend({ ...newBackend, port: parseInt(e.target.value) || 8080 })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control bg-dark text-white border-secondary"
                        rows="2"
                        placeholder="Optional description..."
                        value={newBackend.description}
                        onChange={(e) =>
                          setNewBackend({ ...newBackend, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={newBackend.enabled}
                        onChange={(e) =>
                          setNewBackend({ ...newBackend, enabled: e.target.checked })
                        }
                      />
                      <label className="form-check-label">Enable backend</label>
                    </div>
                  </div>
                  <div className="modal-footer border-secondary">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onCloseManageBackends}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-plus-circle me-2"></i>Add Backend
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={onCloseManageBackends}></div>
        </>
      )}

      {/* Backend Detail Modal */}
      {showBackendDetail && selectedBackend && (
        <>
          <div className="modal fade show d-block" tabIndex={-1}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content bg-dark text-white border-secondary">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">
                    <i className="bi bi-hdd-network me-2"></i>
                    {selectedBackend.name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowBackendDetail(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <div className="card bg-black border-secondary">
                        <div className="card-body">
                          <h6 className="text-secondary mb-3">Backend Information</h6>
                          <table className="table table-dark table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-secondary" style={{ width: '30%' }}>ID:</td>
                                <td className="font-monospace">{selectedBackend.id}</td>
                              </tr>
                              <tr>
                                <td className="text-secondary">Name:</td>
                                <td>{selectedBackend.name}</td>
                              </tr>
                              <tr>
                                <td className="text-secondary">Host:</td>
                                <td>{selectedBackend.host}</td>
                              </tr>
                              <tr>
                                <td className="text-secondary">Port:</td>
                                <td>{selectedBackend.port}</td>
                              </tr>
                              <tr>
                                <td className="text-secondary">URL:</td>
                                <td>
                                  <a
                                    href={`http://${selectedBackend.host}:${selectedBackend.port}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary"
                                  >
                                    http://{selectedBackend.host}:{selectedBackend.port}
                                    <i className="bi bi-box-arrow-up-right ms-2"></i>
                                  </a>
                                </td>
                              </tr>
                              {selectedBackend.description && (
                                <tr>
                                  <td className="text-secondary">Description:</td>
                                  <td>{selectedBackend.description}</td>
                                </tr>
                              )}
                              <tr>
                                <td className="text-secondary">Status:</td>
                                <td>
                                  <span
                                    className={`badge ${
                                      selectedBackend.enabled ? 'bg-success' : 'bg-secondary'
                                    }`}
                                  >
                                    {selectedBackend.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="card bg-black border-secondary">
                        <div className="card-body">
                          <h6 className="text-secondary mb-3">Actions</h6>
                          <div className="d-flex gap-2">
                            <button
                              className={`btn ${selectedBackend.enabled ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => {
                                handleToggleBackend(selectedBackend);
                                setShowBackendDetail(false);
                              }}
                            >
                              <i className={`bi ${selectedBackend.enabled ? 'bi-pause-circle' : 'bi-play-circle'} me-2`}></i>
                              {selectedBackend.enabled ? 'Disable' : 'Enable'} Backend
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => {
                                handleDeleteBackend(selectedBackend.id);
                                setShowBackendDetail(false);
                              }}
                            >
                              <i className="bi bi-trash me-2"></i>Delete Backend
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowBackendDetail(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowBackendDetail(false)}></div>
        </>
      )}
    </div>
  );
};

export default ParkingTab;
