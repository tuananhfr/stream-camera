interface CameraHeaderProps {
  name: string;
  type: "ENTRY" | "EXIT" | "PARKING_LOT";
  location?: string;
  isConnected: boolean;
}

export const CameraHeader = ({
  name,
  type,
  location,
  isConnected,
}: CameraHeaderProps) => {
  return (
    <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2 px-3">
      <div className="d-flex flex-column">
        {location && (
          <small className="text-white-50" style={{ fontSize: "0.8rem" }}>
            {location}
          </small>
        )}
        <h6 className="mb-0 small">
          <i className="bi bi-camera-video-fill me-1"></i>
          {name}
        </h6>
      </div>
      <div className="d-flex align-items-center gap-2">
        <span
          className={`badge ${
            type === "ENTRY"
              ? "bg-success"
              : type === "EXIT"
              ? "bg-danger"
              : "bg-secondary"
          }`}
        >
          {type === "ENTRY" ? "VÀO" : type === "EXIT" ? "RA" : "TRONG BÃI"}
        </span>

        <i
          className={`bi bi-circle-fill fs-6 ${
            isConnected ? "text-success" : "text-secondary"
          }`}
        ></i>
      </div>
    </div>
  );
};

export default CameraHeader;
