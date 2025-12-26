const API_BASE = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5001"}/api/camera-ai`;

export interface Camera {
  id: number;
  name: string;
  type: "ENTRY" | "EXIT" | "PARKING_LOT";
  status: "online" | "offline";
  last_heartbeat?: string;
  events_sent?: number;
  events_failed?: number;
  location?: string;
  stream_proxy?: any;
  control_proxy?: any;
}

export interface Stats {
  total: number;
  in_parking: number;
  total_out: number;
}

export interface HistoryEntry {
  id: number;
  event_id?: string;
  plate_id: string;
  plate_view: string;
  entry_time: string;
  exit_time?: string;
  duration?: string;
  fee?: number;
  status: "IN" | "OUT";
  camera_name?: string;
  location?: string;
  is_anomaly?: boolean;
}

export const cameraAIApi = {
  // Get all cameras
  async getCameras(): Promise<{ cameras: Camera[]; total: number; online: number; offline: number }> {
    const response = await fetch(`${API_BASE}/cameras`);
    if (!response.ok) throw new Error("Failed to fetch cameras");
    const result = await response.json();
    return result;
  },

  // Get parking statistics
  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) throw new Error("Failed to fetch stats");
    const result = await response.json();
    return result;
  },

  // Get parking history
  async getHistory(params?: {
    limit?: number;
    offset?: number;
    today_only?: boolean;
    status?: string;
    search?: string;
    in_parking_only?: boolean;
  }): Promise<{
    history: HistoryEntry[];
    count: number;
    stats: Stats;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set("limit", params.limit.toString());
    if (params?.offset) queryParams.set("offset", params.offset.toString());
    if (params?.today_only) queryParams.set("today_only", "true");
    if (params?.status) queryParams.set("status", params.status);
    if (params?.search) queryParams.set("search", params.search);
    if (params?.in_parking_only) queryParams.set("in_parking_only", "true");

    const response = await fetch(`${API_BASE}/history?${queryParams}`);
    if (!response.ok) throw new Error("Failed to fetch history");
    const result = await response.json();
    return result;
  },

  // Update history entry (edit plate number)
  async updateHistory(historyId: number, plateId: string, plateView: string): Promise<void> {
    const response = await fetch(`${API_BASE}/history/${historyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate_id: plateId, plate_view: plateView }),
    });
    if (!response.ok) throw new Error("Failed to update history");
  },

  // Delete history entry
  async deleteHistory(historyId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/history/${historyId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete history");
  },

  // WebSocket for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    const wsUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5001").replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/camera-ai`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    return ws;
  },
};
