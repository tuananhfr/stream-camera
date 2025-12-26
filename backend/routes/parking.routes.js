const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const router = express.Router();
const PARKING_BACKENDS_PATH = path.join(__dirname, "../parking.backends.json");

// Helper functions
async function loadParkingBackends() {
  try {
    const data = await fs.readFile(PARKING_BACKENDS_PATH, "utf8");
    return JSON.parse(data);
  } catch (e) {
    // File doesn't exist or invalid, return empty array
    return [];
  }
}

async function saveParkingBackends(backends) {
  await fs.writeFile(
    PARKING_BACKENDS_PATH,
    JSON.stringify(backends, null, 2),
    "utf8"
  );
}

// ============ Parking Backend Management Routes ============

// GET /api/parking/backends - Get all parking backends
router.get("/backends", async (req, res) => {
  try {
    const backends = await loadParkingBackends();
    res.json({ success: true, data: backends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parking/backends - Add new parking backend
router.post("/backends", async (req, res) => {
  try {
    const { id, name, host, port, description, enabled } = req.body;

    if (!id || !name || !host || !port) {
      return res
        .status(400)
        .json({ error: "Missing required fields: id, name, host, port" });
    }

    const backends = await loadParkingBackends();

    // Check for duplicate ID
    if (backends.some((b) => b.id === id)) {
      return res
        .status(400)
        .json({ error: "Backend with this ID already exists" });
    }

    const newBackend = {
      id,
      name,
      host,
      port: Number(port),
      description: description || "",
      enabled: enabled !== false, // Default to true
    };

    backends.push(newBackend);
    await saveParkingBackends(backends);

    res.json({ success: true, data: newBackend });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parking/backends/:id - Remove parking backend
router.delete("/backends/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const backends = await loadParkingBackends();

    const filtered = backends.filter((b) => b.id !== id);

    if (filtered.length === backends.length) {
      return res.status(404).json({ error: "Backend not found" });
    }

    await saveParkingBackends(filtered);
    res.json({ success: true, message: "Backend removed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parking/backends/:id - Update parking backend
router.put("/backends/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, host, port, description, enabled } = req.body;

    const backends = await loadParkingBackends();
    const index = backends.findIndex((b) => b.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Backend not found" });
    }

    // Update backend
    backends[index] = {
      ...backends[index],
      ...(name && { name }),
      ...(host && { host }),
      ...(port && { port: Number(port) }),
      ...(description !== undefined && { description }),
      ...(enabled !== undefined && { enabled }),
    };

    await saveParkingBackends(backends);
    res.json({ success: true, data: backends[index] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
