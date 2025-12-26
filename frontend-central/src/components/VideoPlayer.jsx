import { useEffect, useRef, useState } from 'react';

const GO2RTC_URL = 'http://localhost:1984';

const VideoPlayer = ({ camera }) => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const streamSetRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ws = null;
    let pc = null;

    const startStream = async () => {
      try {
        setLoading(true);
        setError('');
        streamSetRef.current = false;

        // Create WebRTC peer connection
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Handle incoming tracks
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0] && !streamSetRef.current) {
            streamSetRef.current = true;
            const video = videoRef.current;
            video.srcObject = event.streams[0];

            video.setAttribute('playsinline', 'true');

            const tryPlay = () => {
              video.play()
                .then(() => setLoading(false))
                .catch(() => setLoading(false));
            };

            video.onloadedmetadata = () => tryPlay();
            if (video.readyState >= 1) tryPlay();

            video.onerror = () => {
              setError(`Video error: ${video.error?.message || 'Unknown'}`);
              setLoading(false);
            };

            video.onplaying = () => setLoading(false);
          }
        };

        // Monitor ICE connection state
        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            setError(`Connection ${pc.iceConnectionState}`);
            setLoading(false);
          }
        };

        // Add transceiver for receiving video
        pc.addTransceiver('video', { direction: 'recvonly' });
        if (camera.hasAudio !== false) {
          pc.addTransceiver('audio', { direction: 'recvonly' });
        }

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Build stream URL with quality params
        const params = ['video=copy'];
        if (camera.hasAudio) {
          params.push('audio=copy');
        }
        const streamUrl = `${camera.url}#${params.join('#')}`;
        const wsUrl = `${GO2RTC_URL}/api/ws?src=${encodeURIComponent(streamUrl)}`;

        // Connect to go2rtc WebSocket
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws?.send(JSON.stringify({
            type: 'webrtc/offer',
            value: offer.sdp,
          }));
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'webrtc/answer') {
            await pc.setRemoteDescription({
              type: 'answer',
              sdp: msg.value,
            });
          } else if (msg.type === 'webrtc/candidate') {
            try {
              await pc.addIceCandidate(new RTCIceCandidate({
                candidate: msg.value,
                sdpMid: '0',
              }));
            } catch (err) {
              // Ignore ICE candidate errors
            }
          } else if (msg.type === 'error') {
            setError(msg.value || 'Stream error');
            setLoading(false);
          }
        };

        ws.onerror = () => {
          setError('WebSocket connection failed');
          setLoading(false);
        };

        ws.onclose = (event) => {
          if (event.code !== 1000) {
            setError(`Connection closed: ${event.reason || 'Unknown error'}`);
            setLoading(false);
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start stream');
        setLoading(false);
      }
    };

    startStream();

    return () => {
      streamSetRef.current = false;
      if (ws) {
        ws.close();
      }
      if (pc) {
        pc.close();
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camera.url, camera.hasAudio]);

  return (
    <div className="position-relative bg-black" style={{ aspectRatio: '16/9' }}>
      {loading && (
        <div className="position-absolute top-50 start-50 translate-middle">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="position-absolute top-50 start-50 translate-middle w-75">
          <div className="alert alert-danger mb-0 text-center" role="alert">
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
        className="w-100 h-100"
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
};

export default VideoPlayer;
