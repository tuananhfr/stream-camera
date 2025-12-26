import { useEffect, useRef, useState } from "react";
import type { Camera } from "../../services/cameraAIApi";
import CameraHeader from "./ui/CameraHeader";
import VideoStream from "./video/VideoStream";
import PlateImage from "./plate/PlateImage";
import VehicleInfo from "./vehicle/VehicleInfo";

interface CameraViewProps {
  camera: Camera;
}

interface Detection {
  class: string;
  confidence: number;
  bbox: number[];
  plate_text?: string;
}

interface VehicleData {
  entry_time: string | null;
  exit_time: string | null;
  fee: number;
  duration: string | null;
  is_anomaly: boolean;
}

export const CameraView = ({ camera }: CameraViewProps) => {
  const streamProxy = camera?.stream_proxy;
  const controlProxy = camera?.control_proxy;

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [plateText, setPlateText] = useState("");
  const [plateImage, setPlateImage] = useState<string | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleData>({
    entry_time: null,
    exit_time: null,
    fee: 0,
    duration: null,
    is_anomaly: false,
  });

  // Setup WebRTC connection for video streaming
  useEffect(() => {
    if (!streamProxy?.webrtc_url) return;

    const setupWebRTC = async () => {
      try {
        // Create peer connection
        const peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        peerRef.current = peer;

        // Handle incoming stream
        peer.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setIsConnected(true);
          }
        };

        // Create offer
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        // Send offer to backend
        const response = await fetch(streamProxy.webrtc_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
          }),
        });

        const answer = await response.json();

        // Set remote description
        await peer.setRemoteDescription(
          new RTCSessionDescription({
            sdp: answer.sdp,
            type: answer.type,
          })
        );
      } catch (error) {
        console.error("WebRTC setup failed:", error);
        // Retry after 4 seconds
        retryRef.current = setTimeout(setupWebRTC, 4000);
      }
    };

    setupWebRTC();

    return () => {
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (retryRef.current) {
        clearTimeout(retryRef.current);
      }
    };
  }, [streamProxy?.webrtc_url]);

  // Setup WebSocket for detections
  useEffect(() => {
    if (!controlProxy?.ws_url) return;

    const setupWebSocket = () => {
      try {
        const ws = new WebSocket(controlProxy.ws_url);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "detection") {
              setDetections(data.detections || []);

              // Extract plate info
              const plateDetection = data.detections?.find(
                (d: Detection) => d.plate_text
              );
              if (plateDetection?.plate_text) {
                setPlateText(plateDetection.plate_text);
              }
            } else if (data.type === "plate_image") {
              setPlateImage(data.image);
            } else if (data.type === "vehicle_info") {
              setVehicleInfo(data.vehicle || {});
            }
          } catch (error) {
            console.error("WebSocket message error:", error);
          }
        };

        ws.onerror = () => {
          console.error("WebSocket error");
        };

        ws.onclose = () => {
          // Retry connection after 4 seconds
          setTimeout(setupWebSocket, 4000);
        };
      } catch (error) {
        console.error("WebSocket setup failed:", error);
      }
    };

    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [controlProxy?.ws_url]);

  // Video loaded handler
  const handleVideoLoaded = () => {
    setIsVideoLoaded(true);
  };

  return (
    <div className="card h-100 bg-dark text-white">
      {/* Camera Header */}
      <CameraHeader
        name={camera.name}
        type={camera.type}
        location={camera.location}
        isConnected={isConnected}
      />

      {/* Video Stream */}
      <div className="card-body p-0 position-relative">
        <VideoStream
          videoRef={videoRef}
          canvasRef={canvasRef}
          detections={detections}
          isVideoLoaded={isVideoLoaded}
          onVideoLoaded={handleVideoLoaded}
        />
      </div>

      {/* Plate Image */}
      <div className="card-footer bg-dark border-top p-2">
        <PlateImage plateImage={plateImage} plateText={plateText} />
      </div>

      {/* Vehicle Info */}
      <div className="card-footer bg-dark border-top p-2">
        <VehicleInfo
          cameraType={camera.type}
          vehicleInfo={vehicleInfo}
        />
      </div>
    </div>
  );
};
