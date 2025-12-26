import type { Camera } from "../types/camera";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

export class BackendApi {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_API_URL) {
    this.baseUrl = baseUrl;
  }

  // Get all cameras from config file
  async getCameras(): Promise<Camera[]> {
    const response = await fetch(`${this.baseUrl}/api/cameras`);
    if (!response.ok) {
      throw new Error("Failed to fetch cameras");
    }
    return response.json();
  }

  // Add a new camera to config file
  async addCamera(camera: Camera): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/cameras`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: camera.id,
        url: camera.url,
        name: camera.name,
        type: camera.type,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add camera");
    }
  }

  // Update a camera
  async updateCamera(camera: Camera, oldId?: string): Promise<Camera> {
    const response = await fetch(
      `${this.baseUrl}/api/cameras/${oldId || camera.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: camera.url,
          name: camera.name,
          type: camera.type,
          newId: camera.id !== oldId ? camera.id : undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update camera");
    }

    const result = await response.json();
    // Return updated camera with potentially new ID
    return {
      ...camera,
      id: result.id || camera.id,
    };
  }

  // Remove a camera from config file
  async removeCamera(cameraId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/cameras/${cameraId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to remove camera");
    }
  }
}

export const backendApi = new BackendApi();
