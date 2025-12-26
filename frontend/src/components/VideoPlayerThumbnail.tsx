import { useEffect, useRef, useState } from "react";
import type { Camera } from "../types/camera";
import { go2rtcApi } from "../services/go2rtcApi";
import "./VideoPlayer.css";

interface VideoPlayerThumbnailProps {
  camera: Camera;
  onClick?: () => void;
}

export const VideoPlayerThumbnail = ({
  camera,
  onClick,
}: VideoPlayerThumbnailProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamSetRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
            video.muted = true;

            const tryPlay = () => {
              video
                .play()
                .then(() => {
                  setLoading(false);
                  setError(""); // Clear error when video plays successfully
                })
                .catch(() => setLoading(false));
            };

            video.onloadedmetadata = () => tryPlay();
            if (video.readyState >= 1) tryPlay();

            video.onerror = () => {
              setError(`Video error`);
              setLoading(false);
            };

            video.onplaying = () => {
              setLoading(false);
              setError(""); // Clear error when video starts playing
            };
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
          } else if (
            pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed"
          ) {
            // Clear error when connection is successful
            setError("");
          }
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            setError("Connection failed");
            setLoading(false);
          } else if (pc.connectionState === "connected") {
            // Clear error when connection is successful
            setError("");
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

        // Connect to go2rtc WebSocket using LOW QUALITY stream
        const wsUrl = go2rtcApi.getStreamUrl(
          camera.url,
          "low",
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
            setError(`Connection closed`);
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
  }, [camera.url]);

  return (
    <div
      className="card bg-dark border-secondary text-white h-100 camera-thumbnail d-flex flex-column"
      style={{
        cursor: onClick ? "pointer" : "default",
        minHeight: 0,
        maxHeight: "100%",
        width: "100%",
        overflow: "hidden",
      }}
      onClick={onClick}
    >
      <div
        className="card-header p-1 flex-shrink-0"
        style={{ minHeight: "24px", maxHeight: "24px", padding: "2px 4px" }}
      >
        <h6
          className="card-title mb-0 text-truncate"
          style={{ fontSize: "0.7rem", lineHeight: "1.2" }}
        >
          {camera.name}
        </h6>
      </div>

      <div
        ref={containerRef}
        className="card-body p-0 position-relative video-container flex-grow-1"
        style={{
          minHeight: 0,
          overflow: "hidden",
          width: "100%",
          height: "100%",
          background: "#000",
          position: "relative",
          flex: "1 1 auto",
        }}
      >
        {loading && (
          <div className="position-absolute top-50 start-50 translate-middle z-3">
            <div
              className="spinner-border spinner-border-sm text-primary"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="position-absolute top-50 start-50 translate-middle w-75 z-3">
            <div
              className="alert alert-danger mb-0 p-1"
              role="alert"
              style={{ fontSize: "0.75rem" }}
            >
              <i className="bi bi-exclamation-triangle me-1"></i>
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
            width: "100%",
            height: "100%",
            minWidth: 0,
            minHeight: 0,
          }}
        />
      </div>
    </div>
  );
};
