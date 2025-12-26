interface VehicleData {
  entry_time: string | null;
  exit_time: string | null;
  fee: number;
  duration: string | null;
  is_anomaly: boolean;
}

interface VehicleInfoProps {
  cameraType: "ENTRY" | "EXIT" | "PARKING_LOT";
  vehicleInfo: VehicleData;
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const VehicleInfo = ({ vehicleInfo, cameraType }: VehicleInfoProps) => {
  // Camera PARKING_LOT: hiển thị Vào + trạng thái
  if (cameraType === "PARKING_LOT") {
    return (
      <div className="mb-2">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
            {vehicleInfo.entry_time ? (
              <>
                <i
                  className="bi bi-arrow-down-circle text-success me-1"
                  style={{ fontSize: "0.7rem" }}
                ></i>
                Vào: {formatTime(new Date(vehicleInfo.entry_time))}
              </>
            ) : (
              <>
                <i
                  className="bi bi-arrow-down-circle me-1"
                  style={{ fontSize: "0.7rem", opacity: 0.5 }}
                ></i>
                Vào: Chờ xe...
              </>
            )}
          </div>
          {vehicleInfo.is_anomaly && (
            <span className="badge bg-warning text-dark" style={{ fontSize: "0.7rem" }}>
              <i className="bi bi-exclamation-triangle-fill me-1"></i>
              Bất thường
            </span>
          )}
        </div>
      </div>
    );
  }

  // Camera ENTRY/EXIT: hiển thị đầy đủ thông tin
  return (
    <div className="mb-2">
      {/* Hàng 1: Vào */}
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
          {vehicleInfo.entry_time ? (
            <>
              <i
                className="bi bi-arrow-down-circle text-success me-1"
                style={{ fontSize: "0.7rem" }}
              ></i>
              Vào: {formatTime(new Date(vehicleInfo.entry_time))}
            </>
          ) : (
            <>
              <i
                className="bi bi-arrow-down-circle me-1"
                style={{ fontSize: "0.7rem", opacity: 0.5 }}
              ></i>
              Vào: Chờ xe...
            </>
          )}
        </div>
        {vehicleInfo.is_anomaly && (
          <span className="badge bg-warning text-dark" style={{ fontSize: "0.7rem" }}>
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            Bất thường
          </span>
        )}
      </div>

      {/* Hàng 2: Ra + Giá vé
          - Cổng EXIT: hiển thị bình thường
          - Cổng ENTRY: render block ẩn (visibility:hidden) để giữ chiều cao
      */}
      <div
        className="d-flex justify-content-between align-items-center"
        style={cameraType === "EXIT" ? undefined : { visibility: "hidden" }}
      >
        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
          {vehicleInfo.exit_time ? (
            <>
              <i
                className="bi bi-arrow-up-circle text-danger me-1"
                style={{ fontSize: "0.7rem" }}
              ></i>
              Ra: {formatTime(new Date(vehicleInfo.exit_time))}
            </>
          ) : (
            <>
              <i
                className="bi bi-arrow-up-circle me-1"
                style={{ fontSize: "0.7rem", opacity: 0.5 }}
              ></i>
              Ra: Chưa có
            </>
          )}
        </div>
        <div className="text-end">
          <div
            className={
              vehicleInfo.fee > 0 ? "fw-bold text-success" : "text-muted"
            }
            style={{ fontSize: "0.85rem" }}
          >
            {(vehicleInfo.fee || 0).toLocaleString("vi-VN")}
            <strong>đ</strong>
          </div>
          {vehicleInfo.duration && (
            <div className="text-muted" style={{ fontSize: "0.65rem" }}>
              <i className="bi bi-clock me-1"></i>
              {vehicleInfo.duration}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleInfo;
