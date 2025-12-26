const express = require("express");
const router = express.Router();
const CameraAIDatabase = require("../helpers/cameraAIDatabase");
const CameraRegistry = require("../helpers/cameraRegistry");
const { loadConfig, saveConfig } = require("../helpers/cameraAIConfig");

const db = new CameraAIDatabase();
const cameraRegistry = new CameraRegistry(60); // 60 second timeout

// Start camera registry monitoring
cameraRegistry.start();

// GET /api/camera-ai/status - Health check / connection status
router.get("/status", (req, res) => {
  res.json({
    success: true,
    status: "online",
    backend_type: "central",
    timestamp: new Date().toISOString()
  });
});

// GET /api/camera-ai/config - Get configuration (for SettingsModal)
router.get("/config", (req, res) => {
  try {
    const config = loadConfig();
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Error loading config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/camera-ai/config - Save configuration
router.post("/config", (req, res) => {
  try {
    const config = req.body;
    const saved = saveConfig(config);

    if (saved) {
      res.json({
        success: true,
        message: "Configuration saved successfully",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to save configuration",
      });
    }
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/camera-ai/staff - Get staff list (stub)
router.get("/staff", (req, res) => {
  res.json({
    success: true,
    staff: []
  });
});

// PUT /api/camera-ai/staff - Update staff list (stub)
router.put("/staff", (req, res) => {
  res.json({
    success: true,
    message: "Staff updated (stub endpoint)"
  });
});

// GET /api/camera-ai/cameras - Get all cameras (merged from config + database)
router.get("/cameras", (req, res) => {
  try {
    // Get cameras from config (edge cameras defined in settings)
    const config = loadConfig();
    const configCameras = config.edge_cameras || {};

    // Get cameras from database (cameras that have sent heartbeat)
    const dbCameras = db.getAllCameras();

    // Create a map of cameras from database by ID
    const dbCameraMap = {};
    dbCameras.forEach(cam => {
      dbCameraMap[cam.id] = cam;
    });

    // Merge: Start with config cameras and enrich with database data
    const cameras = Object.entries(configCameras).map(([id, cam]) => {
      const dbCam = dbCameraMap[id];

      // Use status from database if exists, otherwise offline
      const status = dbCam?.status || "offline";

      return {
        id: id,
        name: cam.name,
        type: cam.camera_type,
        location: `${cam.ip}:${cam.port}`,
        ip: cam.ip,
        port: cam.port,
        status: status,
        last_heartbeat: dbCam?.last_heartbeat || null,
        events_sent: dbCam?.events_sent || 0,
        events_failed: dbCam?.events_failed || 0,
        stream_proxy: null, // TODO: Build proxy info from config
        control_proxy: null, // TODO: Build proxy info from config
      };
    });

    const total = cameras.length;
    const online = cameras.filter((c) => c.status === "online").length;
    const offline = total - online;

    res.json({
      success: true,
      cameras,
      total,
      online,
      offline,
    });
  } catch (error) {
    console.error("Error getting cameras:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/camera-ai/heartbeat - Camera heartbeat
// POST /api/edge/heartbeat - Alternative endpoint for compatibility
router.post(["/heartbeat", "/edge/heartbeat"], (req, res) => {
  try {
    const { camera_id, camera_name, camera_type, events_sent, events_failed } = req.body;

    if (!camera_id) {
      return res.status(400).json({ success: false, error: "camera_id is required" });
    }

    // Update heartbeat using CameraRegistry
    cameraRegistry.updateHeartbeat(
      camera_id,
      camera_name || `Camera ${camera_id}`,
      camera_type || "ENTRY",
      events_sent || 0,
      events_failed || 0
    );

    // Broadcast camera update to WebSocket clients
    if (global.cameraAIWebSocketClients) {
      const message = JSON.stringify({
        type: "cameras_update",
        data: { camera_id },
      });
      global.cameraAIWebSocketClients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/camera-ai/event - Receive event from edge camera
router.post("/event", (req, res) => {
  try {
    const { type, event_id, camera_id, camera_name, camera_type, data } =
      req.body;

    // Check if event already exists (dedupe)
    if (event_id && db.eventExists(event_id)) {
      return res.json({ success: true, deduped: true, event_id });
    }

    if (type === "ENTRY") {
      // Create entry record
      const historyId = db.createEntry({
        event_id,
        plate_id: data.plate_text,
        plate_view: data.plate_view || data.plate_text,
        entry_time: new Date().toISOString(),
        camera_name,
        location: data.location,
        is_anomaly: data.is_anomaly || false,
      });

      // Broadcast to WebSocket clients
      if (global.cameraAIWebSocketClients) {
        const message = JSON.stringify({
          type: "history_update",
          data: { action: "ENTRY", plate_id: data.plate_text },
        });
        global.cameraAIWebSocketClients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(message);
          }
        });
      }

      res.json({
        success: true,
        action: "ENTRY",
        history_id: historyId,
        event_id,
      });
    } else if (type === "EXIT") {
      // Find vehicle in parking
      const vehicle = db.findVehicleInParking(data.plate_text);

      if (!vehicle) {
        return res
          .status(400)
          .json({ success: false, error: "Vehicle not found in parking" });
      }

      // Calculate duration and fee
      const entryTime = new Date(vehicle.entry_time);
      const exitTime = new Date();
      const durationMs = exitTime - entryTime;
      const hours = Math.ceil(durationMs / (1000 * 60 * 60));
      const fee = hours * 25000; // 25k VNĐ per hour

      // Update exit
      db.updateExit(data.plate_text, {
        exit_time: exitTime.toISOString(),
        duration: `${hours} giờ`,
        fee,
      });

      // Broadcast to WebSocket clients
      if (global.cameraAIWebSocketClients) {
        const message = JSON.stringify({
          type: "history_update",
          data: { action: "EXIT", plate_id: data.plate_text },
        });
        global.cameraAIWebSocketClients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(message);
          }
        });
      }

      res.json({
        success: true,
        action: "EXIT",
        event_id,
        fee,
        duration: `${hours} giờ`,
      });
    } else {
      res.status(400).json({ success: false, error: "Invalid event type" });
    }
  } catch (error) {
    console.error("Error processing event:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/camera-ai/history - Get parking history
router.get("/history", (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      search,
      status,
      in_parking_only,
    } = req.query;

    const history = db.getHistory({
      limit: parseInt(limit),
      offset: parseInt(offset),
      search,
      status,
      in_parking_only: in_parking_only === "true",
    });

    const stats = db.getStats();

    res.json({
      success: true,
      history,
      count: history.length,
      stats,
    });
  } catch (error) {
    console.error("Error getting history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/camera-ai/stats - Get statistics
router.get("/stats", (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/camera-ai/history/:id - Update history entry
router.put("/history/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { plate_id, plate_view } = req.body;

    db.updateHistoryEntry(parseInt(id), plate_id, plate_view);

    // Broadcast update
    if (global.cameraAIWebSocketClients) {
      const message = JSON.stringify({
        type: "history_update",
        data: { action: "UPDATE", history_id: id },
      });
      global.cameraAIWebSocketClients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/camera-ai/history/:id - Delete history entry
router.delete("/history/:id", (req, res) => {
  try {
    const { id } = req.params;

    db.deleteHistoryEntry(parseInt(id));

    // Broadcast delete
    if (global.cameraAIWebSocketClients) {
      const message = JSON.stringify({
        type: "history_update",
        data: { action: "DELETE", history_id: id },
      });
      global.cameraAIWebSocketClients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
