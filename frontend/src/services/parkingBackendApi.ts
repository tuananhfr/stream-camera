import type { ParkingBackend } from "../types/parkingBackend";

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5001"}/api/parking`;

export const parkingBackendApi = {
  // Get all parking backends
  async getBackends(): Promise<ParkingBackend[]> {
    const response = await fetch(`${API_BASE}/backends`);
    if (!response.ok) {
      throw new Error("Failed to fetch parking backends");
    }
    const data = await response.json();
    return data.data;
  },

  // Add new parking backend
  async addBackend(backend: ParkingBackend): Promise<ParkingBackend> {
    const response = await fetch(`${API_BASE}/backends`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backend),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add backend");
    }

    const data = await response.json();
    return data.data;
  },

  // Update parking backend
  async updateBackend(
    id: string,
    updates: Partial<ParkingBackend>
  ): Promise<ParkingBackend> {
    const response = await fetch(`${API_BASE}/backends/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update backend");
    }

    const data = await response.json();
    return data.data;
  },

  // Remove parking backend
  async removeBackend(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/backends/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to remove backend");
    }
  },
};
