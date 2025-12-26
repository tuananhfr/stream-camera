import { useEffect, useRef, useState } from 'react';

const GO2RTC_URL = 'http://localhost:1984';

const VideoPlayerThumbnail = ({ camera, onClick }) => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
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
            video.muted = true;

            const tryPlay = () => {
              video.play()
                .then(() => {
                  setLoading(false);
                  setError('');
                })
                .catch(() => setLoading(false));
            };

            video.onloadedmetadata = () => tryPlay();
            if (video.readyState >= 1) tryPlay();

            video.onerror = () => {
              setError('Video error');
              setLoading(false);
            };

            video.onplaying = () => {
              setLoading(false);
              setError('');
            };
          }
        };

        // Monitor ICE connection state
        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            setError(`Connection ${pc.iceConnectionState}`);
            setLoading(false);
          } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setError('');
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

        // Build LOW QUALITY stream URL for thumbnails
        const params = ['video=h264', 'scale=640:360'];
        if (camera.hasAudio) {
          params.push('audio=copy');
        }
        const streamUrl = `${camera.url}#${params.join('#')}`;
        const wsUrl = `${GO2RTC_URL}/api/ws?src=${encodeURIComponent(streamUrl)}`;

        // Connect to go2rtc WebSocket
        ws = new WebSocket(wsUrl);

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
          setError('WebSocket failed');
          setLoading(false);
        };

        ws.onclose = (event) => {
          if (event.code !== 1000) {
            setError('Connection closed');
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
    <div
      className="card bg-dark border-secondary text-white h-100 camera-thumbnail d-flex flex-column"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 0,
        maxHeight: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
      onClick={onClick}
    >
      <div
        className="card-header p-1 flex-shrink-0"
        style={{ minHeight: '24px', maxHeight: '24px', padding: '2px 4px' }}
      >
        <h6
          className="card-title mb-0 text-truncate"
          style={{ fontSize: '0.7rem', lineHeight: '1.2' }}
        >
          {camera.name}
        </h6>
      </div>

      <div
        className="card-body p-0 position-relative video-container flex-grow-1"
        style={{
          minHeight: 0,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          background: '#000',
          position: 'relative',
          flex: '1 1 auto',
        }}
      >
        {loading && (
          <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 3 }}>
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="position-absolute top-50 start-50 translate-middle w-75" style={{ zIndex: 3 }}>
            <div className="alert alert-danger mb-0 p-1" role="alert" style={{ fontSize: '0.75rem' }}>
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
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{
            objectFit: 'contain',
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
          }}
        />
      </div>
    </div>
  );
};

export default VideoPlayerThumbnail;
