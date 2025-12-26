const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

interface CreateTimelapseRequest {
  source?: string;
  intervalSeconds: number;
  file?: File | null;
}

interface CreateTimelapseResponse {
  videoUrl: string;
}

export interface TimelapseItem {
  id: string;
  videoUrl: string;
  createdAt?: number;
  size?: number;
}

export interface TimelapseConfig {
  intervalSeconds: number;
  periodValue: number;
  periodUnit: "hour" | "day" | "month" | "year";
  enabledCameraIds: string[];
}

export class TimelapseApi {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_API_URL) {
    this.baseUrl = baseUrl;
  }

  async createTimelapse(
    payload: CreateTimelapseRequest
  ): Promise<CreateTimelapseResponse> {
    const form = new FormData();
    form.append("intervalSeconds", String(payload.intervalSeconds));
    if (payload.source) {
      form.append("source", payload.source);
    }
    if (payload.file) {
      form.append("file", payload.file);
    }

    const response = await fetch(`${this.baseUrl}/api/timelapse`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Tạo timelapse thất bại");
    }

    return response.json();
  }

  async listTimelapse(): Promise<TimelapseItem[]> {
    const response = await fetch(`${this.baseUrl}/api/timelapse`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Không lấy được danh sách timelapse");
    }
    const result = await response.json();
    return result.data || [];
  }

  async getConfig(): Promise<TimelapseConfig> {
    const response = await fetch(`${this.baseUrl}/api/timelapse/config`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Không tải được cấu hình timelapse");
    }
    const result = await response.json();
    return result.data || result;
  }

  async updateConfig(config: TimelapseConfig): Promise<TimelapseConfig> {
    const response = await fetch(`${this.baseUrl}/api/timelapse/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Không lưu được cấu hình timelapse");
    }

    const result = await response.json();
    return result.data || result;
  }
}

export const timelapseApi = new TimelapseApi();
