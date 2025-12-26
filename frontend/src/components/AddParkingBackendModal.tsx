import { useState, useEffect } from "react";
import type { ParkingBackend } from "../types/parkingBackend";

interface AddParkingBackendModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (backend: ParkingBackend) => void;
}

export const AddParkingBackendModal = ({
  show,
  onClose,
  onAdd,
}: AddParkingBackendModalProps) => {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(3000);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [show]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !host.trim() || port <= 0) {
      alert("Please fill in all required fields");
      return;
    }

    // Auto-generate ID from host and port
    const generatedId = `${host.trim().replace(/\./g, "_")}_${port}`;

    onAdd({
      id: generatedId,
      name: name.trim(),
      host: host.trim(),
      port,
      description: description.trim(),
      enabled: true,
    });

    // Reset form
    setName("");
    setHost("");
    setPort(3000);
    setDescription("");
    onClose();
  };

  const handleClose = () => {
    setName("");
    setHost("");
    setPort(3000);
    setDescription("");
    onClose();
  };

  if (!show) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content bg-black text-white border-secondary">
            <div className="modal-header border-secondary">
              <h5 className="modal-title">
                <i className="bi bi-plus-circle me-2"></i>
                Add Parking Backend
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
              ></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">
                    Display Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="e.g., Bãi đỗ xe A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Host / IP Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="e.g., 192.168.1.100 or localhost"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Port <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="e.g., 3000"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="Additional information about this parking lot..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i>
                    Add Backend
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={handleClose}
      ></div>
    </>
  );
};
