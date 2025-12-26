import { useEffect, useRef, useState } from "react";
import type { Camera } from "../types/camera";
import { go2rtcApi } from "../services/go2rtcApi";
import "./VideoPlayer.css";

interface CameraModalProps {
  camera: Camera | null;
  show: boolean;
  onClose: () => void;
  onEdit?: (camera: Camera) => void;
}

export const CameraModal = ({
  camera,
  show,
  onClose,
  onEdit,
}: CameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamSetRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  useEffect(() => {
    if (!show || !camera) {
      // Cleanup when modal closes
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      streamSetRef.current = false;
      return;
    }

    let ws: WebSocket | null = null;

    const startStream = async () => {
      try {
        setLoading(true);
        setError("");

        // Create WebRTC peer connection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        // Handle incoming tracks
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0] && !streamSetRef.current) {
            streamSetRef.current = true;
            const video = videoRef.current;
            video.srcObject = event.streams[0];
            video.setAttribute("playsinline", "true");

            const tryPlay = () => {
              video
                .play()
                .then(() => {
                  setLoading(false);
                  // Minimize buffering for low latency
                  if (video.buffered.length > 0) {
                    const latency = video.currentTime - video.buffered.start(0);
                    if (latency > 0.5) {
                      video.currentTime = video.buffered.end(0) - 0.1;
                    }
                  }
                })
                .catch(() => setLoading(false));
            };

            video.onloadedmetadata = () => tryPlay();
            if (video.readyState >= 1) tryPlay();

            video.onerror = () => {
              setError(`Video error: ${video.error?.message || "Unknown"}`);
              setLoading(false);
            };

            video.onplaying = () => setLoading(false);
          }
        };

        // Monitor ICE connection state
        pc.oniceconnectionstatechange = () => {
          if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            setError(`Connection ${pc.iceConnectionState}`);
            setLoading(false);
          }
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            setError("Connection failed");
            setLoading(false);
          }
        };

        // Add transceiver for receiving video
        pc.addTransceiver("video", { direction: "recvonly" });
        // Only add audio transceiver if camera has audio stream
        // Cameras without audio (like IMX500) will cause errors if we request audio
        if (camera.hasAudio !== false) {
          pc.addTransceiver("audio", { direction: "recvonly" });
        }

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Connect to go2rtc WebSocket using HIGH QUALITY stream
        const wsUrl = go2rtcApi.getStreamUrl(
          camera.url,
          "high",
          camera.hasAudio ?? false
        );
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: "webrtc/offer",
              value: offer.sdp,
            })
          );
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "webrtc/answer") {
            await pc.setRemoteDescription({
              type: "answer",
              sdp: msg.value,
            });
          } else if (msg.type === "webrtc/candidate") {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate({
                  candidate: msg.value,
                  sdpMid: "0",
                })
              );
            } catch (err) {
              // Ignore ICE candidate errors
            }
          } else if (msg.type === "error") {
            setError(msg.value || "Stream error");
            setLoading(false);
          }
        };

        ws.onerror = () => {
          setError("WebSocket connection failed");
          setLoading(false);
        };

        ws.onclose = (event) => {
          if (event.code !== 1000) {
            setError(`Connection closed: ${event.reason || "Unknown error"}`);
            setLoading(false);
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start stream");
        setLoading(false);
      }
    };

    startStream();

    return () => {
      streamSetRef.current = false;
      if (ws) {
        ws.close();
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camera?.url, show]);

  if (!show || !camera) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: "100vh", overflow: "hidden" }}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          style={{ maxHeight: "100vh", margin: "0.5rem auto" }}
        >
          <div
            className="modal-content bg-black text-white border-secondary d-flex flex-column"
            style={{ maxHeight: "100vh" }}
          >
            <div className="modal-header border-secondary d-flex justify-content-between align-items-center flex-shrink-0">
              <h5 className="modal-title mb-0">{camera.name}</h5>
              <div className="d-flex gap-2 align-items-center">
                {onEdit && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onEdit(camera)}
                    title="Edit camera settings"
                  >
                    <i className="bi bi-gear"></i>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={onClose}
                ></button>
              </div>
            </div>
            <div
              className="modal-body p-0 flex-grow-1 d-flex"
              style={{ minHeight: 0, overflow: "hidden" }}
            >
              <div
                ref={containerRef}
                className="position-relative video-container w-100 h-100"
                style={
                  {
                    "--video-zoom": zoom,
                    aspectRatio: "16/9",
                    minHeight: 0,
                    maxHeight: "100%",
                  } as React.CSSProperties
                }
              >
                {loading && (
                  <div className="position-absolute top-50 start-50 translate-middle">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="position-absolute top-50 start-50 translate-middle w-75">
                    <div className="alert alert-danger mb-0" role="alert">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {error}
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="position-absolute top-0 start-0 w-100 h-100 video-element"
                  style={{
                    objectFit: "contain",
                  }}
                />

                {/* Custom Controls */}
                <div className="position-absolute bottom-0 start-0 w-100 video-controls p-2">
                  <div className="d-flex justify-content-between align-items-center">
                    {/* Zoom Controls */}
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm btn-dark"
                        onClick={handleZoomOut}
                        disabled={zoom <= 1}
                        title="Zoom Out"
                      >
                        <i className="bi bi-zoom-out"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-dark"
                        onClick={handleResetZoom}
                        disabled={zoom === 1}
                        title="Reset Zoom"
                      >
                        {Math.round(zoom * 100)}%
                      </button>
                      <button
                        className="btn btn-sm btn-dark"
                        onClick={handleZoomIn}
                        disabled={zoom >= 5}
                        title="Zoom In"
                      >
                        <i className="bi bi-zoom-in"></i>
                      </button>
                    </div>

                    {/* Fullscreen */}
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={handleFullscreen}
                      title="Fullscreen"
                    >
                      <i className="bi bi-fullscreen"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer border-secondary flex-shrink-0">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  );
};
