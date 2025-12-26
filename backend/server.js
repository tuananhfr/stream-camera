const express = require("express");
const cors = require("cors");
const path = require("path");
const { WebSocketServer } = require("ws");

// Import routes
const cameraRoutes = require("./routes/camera.routes");
const timelapseRoutes = require("./routes/timelapse.routes");
const parkingRoutes = require("./routes/parking.routes");
const cameraAIRoutes = require("./routes/camera-ai.routes");

// Import helpers
const { loadConfigSync } = require("./helpers/config");
const { startTimelapseScheduler } = require("./helpers/timelapseScheduler");

const app = express();
const PORT = process.env.PORT || 5000;
const TIMELAPSE_DIR = path.join(__dirname, "timelapse");

// Global WebSocket clients for Camera AI
global.cameraAIWebSocketClients = new Set();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/timelapse", express.static(TIMELAPSE_DIR));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/cameras", cameraRoutes);
app.use("/api/timelapse", timelapseRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/camera-ai", cameraAIRoutes);

// Load config into memory at startup
const configCache = loadConfigSync();

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
  console.log(
    `📊 Loaded ${Object.keys(configCache.streams || {}).length} cameras`
  );
});

// Setup WebSocket server for Camera AI
const wss = new WebSocketServer({ server, path: "/ws/camera-ai" });

wss.on("connection", (ws) => {
  console.log("Camera AI WebSocket client connected");
  global.cameraAIWebSocketClients.add(ws);

  ws.on("close", () => {
    console.log("Camera AI WebSocket client disconnected");
    global.cameraAIWebSocketClients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("Camera AI WebSocket error:", error);
    global.cameraAIWebSocketClients.delete(ws);
  });
});

// Handle port already in use error
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
    console.error(`\n💡 Solutions:`);
    console.error(`   1. Kill the process using port ${PORT}:`);
    console.error(`      Windows: netstat -ano | findstr :${PORT}`);
    console.error(`      Then: taskkill /PID <PID> /F`);
    console.error(`   2. Or change PORT in server.js to a different port\n`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", error);
    process.exit(1);
  }
});

// Start background timelapse scheduler
startTimelapseScheduler().catch((e) => {
  console.error("Failed to start timelapse scheduler:", e);
});
