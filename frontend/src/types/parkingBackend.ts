export interface ParkingBackend {
  id: string; // Unique identifier
  name: string; // Display name (e.g., "Bãi đỗ xe A")
  host: string; // IP or hostname (e.g., "192.168.1.100" or "localhost")
  port: number; // Port number (e.g., 3000)
  enabled?: boolean; // Whether this backend is active
  description?: string; // Optional description
}

export interface ParkingBackendStats {
  total_devices: number;
  online_devices: number;
  total_lockers: number;
  available_lockers: number;
  occupied_lockers: number;
}
