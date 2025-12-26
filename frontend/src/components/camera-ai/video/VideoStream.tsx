import { useRef, useEffect } from "react";

interface Detection {
  class: string;
  confidence: number;
  bbox: number[];
  text?: string;
  plate_text?: string;
}

interface VideoStreamProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  detections: Detection[];
  isVideoLoaded: boolean;
  onVideoLoaded: () => void;
}

export const VideoStream = ({
  videoRef,
  canvasRef,
  detections,
  isVideoLoaded,
  onVideoLoaded,
}: VideoStreamProps) => {
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef(Date.now());

  // Update last detection time when detections change
  useEffect(() => {
    if (detections.length > 0) {
      lastDetectionTimeRef.current = Date.now();
    }
  }, [detections]);

  const drawDetections = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();
    if (now - lastDetectionTimeRef.current > 1000) {
      // Detection timeout > 1s - clear overlay
      return;
    }

    detections.forEach((detection) => {
      const [x, y, w, h] = detection.bbox;
      let label = detection.class;
      const plateText = detection.text || detection.plate_text;

      if (plateText) {
        label = `${detection.class}: ${plateText}`;
      }
      label += ` (${((detection.confidence || 0) * 100).toFixed(0)}%)`;

      // Green for recognized plates, Blue for unknown
      const color = plateText ? "#00FF00" : "#0000FF";

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Draw label background
      ctx.font = "bold 12px Arial";
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(x, y - 20, textWidth + 10, 20);

      // Draw label text
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, x + 5, y - 5);
    });
  };

  useEffect(() => {
    const draw = () => {
      drawDetections();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detections]);

  return (
    <div className="position-relative bg-black" style={{ aspectRatio: "16/9" }}>
      {!isVideoLoaded && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
          style={{ backgroundColor: "#1a1a1a", zIndex: 10 }}
        >
          <div
            className="spinner-border text-primary mb-3"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={onVideoLoaded}
        className="w-100 h-100 d-block"
        style={{
          objectFit: "contain",
          opacity: isVideoLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
        }}
      />

      <canvas
        ref={canvasRef}
        className="position-absolute top-0 start-0"
        style={{
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          imageRendering: "crisp-edges",
          opacity: isVideoLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
        }}
      />
    </div>
  );
};

export default VideoStream;
