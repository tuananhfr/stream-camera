import type { Camera, Go2RTCStream } from "../types/camera";

const GO2RTC_API_URL = "http://localhost:1984";

export class Go2RTCApi {
  private baseUrl: string;

  constructor(baseUrl: string = GO2RTC_API_URL) {
    this.baseUrl = baseUrl;
  }

  // Get all streams
  async getStreams(): Promise<Record<string, Go2RTCStream>> {
    const response = await fetch(`${this.baseUrl}/api/streams`);
    if (!response.ok) {
      throw new Error("Failed to fetch streams");
    }
    return response.json();
  }

  // Add a new stream
  async addStream(camera: Camera): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        streams: {
          [camera.id]: camera.url,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add stream: ${errorText}`);
    }
  }

  // Remove a stream
  async removeStream(streamId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        streams: {
          [streamId]: null,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to remove stream: ${errorText}`);
    }
  }

  // Get WebRTC stream URL for a camera (using dynamic stream with RTSP URL)
  getStreamUrl(
    cameraUrl: string,
    quality: "low" | "high" = "high",
    hasAudio: boolean = false
  ): string {
    let url = cameraUrl;
    const baseUrl = cameraUrl.split("#")[0];

    // Build params based on quality and audio support
    const params: string[] = [];

    if (quality === "low") {
      // Low quality: scale to 640x360 and use h264 encoding
      params.push("video=h264", "scale=640:360");
    } else {
      // High quality: use copy (original quality)
      params.push("video=copy");
    }

    // Only add audio=copy if camera has audio stream
    // Cameras without audio (like IMX500) will cause EOF errors if we try to copy audio
    if (hasAudio) {
      params.push("audio=copy");
    }

    url = `${baseUrl}#${params.join("#")}`;

    return `${this.baseUrl}/api/ws?src=${encodeURIComponent(url)}`;
  }

  // Get preview image URL
  getSnapshotUrl(cameraId: string): string {
    return `${this.baseUrl}/api/frame.jpeg?src=${cameraId}`;
  }
}

export const go2rtcApi = new Go2RTCApi();
