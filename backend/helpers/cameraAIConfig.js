const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "../data/camera-ai-config.json");

// Default config
const DEFAULT_CONFIG = {
  backend_type: "central",
  edge_cameras: {},
  parking_lot: {
    capacity: 100,
  },
  barrier: {
    enabled: false,
  },
};

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load config from file
const loadConfig = () => {
  try {
    ensureDataDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(data);
    }
    // Return default config if file doesn't exist
    return { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error("Error loading camera AI config:", error);
    return { ...DEFAULT_CONFIG };
  }
};

// Save config to file
const saveConfig = (config) => {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    console.log("Camera AI config saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving camera AI config:", error);
    return false;
  }
};

module.exports = {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
};
