const CameraAIDatabase = require("./cameraAIDatabase");

/**
 * CameraRegistry - Track camera heartbeats and auto-mark offline cameras
 * Based on backend-central/camera_registry.py
 */
class CameraRegistry {
  constructor(heartbeatTimeout = 60) {
    this.db = new CameraAIDatabase();
    this.heartbeatTimeout = heartbeatTimeout; // seconds
    this.checkInterval = null;
  }

  /**
   * Start background monitoring for offline cameras
   */
  start() {
    console.log("📡 Camera Registry started - monitoring heartbeats");

    // Check every 10 seconds for offline cameras
    this.checkInterval = setInterval(() => {
      this.checkOfflineCameras();
    }, 10000);
  }

  /**
   * Stop background monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("Camera Registry stopped");
    }
  }

  /**
   * Update camera heartbeat (called when heartbeat received)
   */
  updateHeartbeat(cameraId, name, cameraType, eventsSent = 0, eventsFailed = 0) {
    try {
      this.db.upsertCamera({
        id: cameraId,
        name: name,
        type: cameraType,
        status: "online", // Always set to online when heartbeat received
        last_heartbeat: new Date().toISOString(),
        events_sent: eventsSent,
        events_failed: eventsFailed,
      });

      console.log(`💓 Heartbeat received from camera: ${cameraId} (${name})`);
    } catch (error) {
      console.error("Failed to update heartbeat:", error);
      throw error;
    }
  }

  /**
   * Check for cameras that haven't sent heartbeat and mark them offline
   */
  checkOfflineCameras() {
    try {
      const cameras = this.db.getAllCameras();
      const now = new Date();
      const timeoutMs = this.heartbeatTimeout * 1000;

      cameras.forEach((camera) => {
        if (camera.status === "online" && camera.last_heartbeat) {
          const lastHeartbeat = new Date(camera.last_heartbeat);
          const timeSinceHeartbeat = now - lastHeartbeat;

          if (timeSinceHeartbeat > timeoutMs) {
            // Mark camera as offline
            this.db.upsertCamera({
              id: camera.id,
              name: camera.name,
              type: camera.type,
              status: "offline",
              last_heartbeat: camera.last_heartbeat,
              events_sent: camera.events_sent || 0,
              events_failed: camera.events_failed || 0,
            });

            console.log(
              `⚠️  Camera ${camera.id} (${camera.name}) marked offline - no heartbeat for ${Math.round(
                timeSinceHeartbeat / 1000
              )}s`
            );
          }
        }
      });
    } catch (error) {
      console.error("Error checking offline cameras:", error);
    }
  }

  /**
   * Get camera status
   */
  getCameraStatus() {
    const cameras = this.db.getAllCameras();
    const total = cameras.length;
    const online = cameras.filter((c) => c.status === "online").length;
    const offline = total - online;

    return {
      total,
      online,
      offline,
      cameras,
    };
  }
}

module.exports = CameraRegistry;
