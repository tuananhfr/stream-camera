const express = require("express");
const {
  readConfig,
  writeConfig,
  addStreamToRuntime,
  removeStreamFromRuntime,
} = require("../helpers/config");

const router = express.Router();

// GET /api/cameras - Get all cameras
router.get("/", (req, res) => {
  try {
    const config = readConfig();
    const streams = config.streams || {};
    const metadata = config.metadata || {};

    const cameras = Object.entries(streams)
      .filter(([key]) => !key.startsWith("#")) // Ignore comments
      .map(([id, urlValue]) => {
        // Remove go2rtc params from URL when returning to frontend
        let url = urlValue;
        if (url && url.includes("#")) {
          url = url.split("#")[0];
        }
        const meta = metadata[id] || {};
        const hasAudio = meta.hasAudio === true;

        return {
          id,
          name:
            meta.name ||
            id.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          type:
            meta.type || (url && url.startsWith("rtsp://") ? "rtsp" : "public"),
          url,
          hasAudio,
        };
      });

    res.json(cameras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cameras - Add a new camera
router.post("/", async (req, res) => {
  try {
    const { id, url, name, type } = req.body;

    if (!id || !url) {
      return res.status(400).json({ error: "Missing id or url" });
    }

    const config = readConfig();

    // Initialize streams and metadata if not exists
    if (!config.streams) {
      config.streams = {};
    }
    if (!config.metadata) {
      config.metadata = {};
    }

    // Check if camera with this id already exists
    if (config.streams[id]) {
      return res.status(400).json({
        error: `Camera with name "${
          name || id
        }" already exists. Please use a different name.`,
      });
    }

    // Store URL as-is
    let finalUrl = url;

    // Add new camera stream
    config.streams[id] = finalUrl;

    // Add camera metadata
    config.metadata[id] = {
      name: name || id,
      type: type || "rtsp",
      hasAudio: false, // Default: no audio
    };

    // Write to file
    writeConfig(config);

    res.json({ success: true, message: "Camera added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cameras/:id - Update a camera
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { url, name, type, newId } = req.body;

    const config = readConfig();

    if (!config.streams || !config.streams[id]) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // If name changed, we need to update the ID
    let targetId = id;
    if (newId && newId !== id) {
      // Check if new ID already exists
      if (config.streams[newId]) {
        return res.status(400).json({
          error: `Camera with name "${
            name || newId
          }" already exists. Please use a different name.`,
        });
      }

      // Migrate camera to new ID
      config.streams[newId] = config.streams[id];
      config.metadata[newId] = config.metadata[id] || {};
      delete config.streams[id];
      delete config.metadata[id];
      targetId = newId;

      // Migrate stream in go2rtc runtime
      try {
        await removeStreamFromRuntime(id);
        await addStreamToRuntime(newId, config.streams[newId]);
      } catch (error) {
        console.error("Error migrating stream in go2rtc:", error);
      }
    }

    // Update camera stream if URL changed
    if (url) {
      let finalUrl = url;
      config.streams[targetId] = finalUrl;

      // Update stream in go2rtc runtime
      try {
        await addStreamToRuntime(targetId, finalUrl);
      } catch (error) {
        console.error("Error updating stream in go2rtc:", error);
      }
    }

    // Update camera metadata
    if (!config.metadata) {
      config.metadata = {};
    }
    if (!config.metadata[targetId]) {
      config.metadata[targetId] = {};
    }

    if (name !== undefined) {
      config.metadata[targetId].name = name;
      if (config.metadata[targetId].hasAudio === undefined) {
        config.metadata[targetId].hasAudio = false;
      }
    }
    if (type !== undefined) {
      config.metadata[targetId].type = type;
    }

    // Write to file
    writeConfig(config);

    res.json({
      success: true,
      message: "Camera updated successfully",
      id: targetId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cameras/:id - Remove a camera
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const config = readConfig();

    if (!config.streams || !config.streams[id]) {
      return res.status(404).json({ error: "Camera not found" });
    }

    // Remove camera stream
    delete config.streams[id];

    // Remove camera metadata
    if (config.metadata && config.metadata[id]) {
      delete config.metadata[id];
    }

    // Write to file
    writeConfig(config);

    res.json({ success: true, message: "Camera removed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
