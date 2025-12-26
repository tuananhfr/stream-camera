export type CameraType = "rtsp" | "public";

export interface Camera {
  id: string;
  name: string;
  type: CameraType;
  url: string;
  enabled?: boolean;
  hasAudio?: boolean; // Whether camera has audio stream (default: true)
}

export interface Go2RTCStream {
  producers?: Array<{
    url: string;
    [key: string]: any;
  }>;
  consumers?: any;
  [key: string]: any;
}
