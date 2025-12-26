const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const http = require("http");

const CONFIG_PATH = path.join(__dirname, "../go2rtc.yaml");

// In-memory cache for config
let configCache = null;
let isWriting = false;
const writeQueue = [];

// Load config into memory at startup
function loadConfigSync() {
  try {
    const fileContents = fsSync.readFileSync(CONFIG_PATH, "utf8");
    configCache = yaml.load(fileContents);

    // Clean up go2rtc params from URLs
    if (configCache.streams) {
      for (const [key, value] of Object.entries(configCache.streams)) {
        if (typeof value === "string" && value.includes("#")) {
          configCache.streams[key] = value.split("#")[0];
        }
      }
    }

    return configCache;
  } catch (e) {
    console.error("Error reading config:", e);
    configCache = { streams: {}, metadata: {} };
    return configCache;
  }
}

// Read config from memory (fast!)
function readConfig() {
  if (!configCache) {
    loadConfigSync();
  }
  return configCache;
}

// Write config to file (async with queue to prevent race conditions)
async function writeConfig(config) {
  // Update cache immediately
  configCache = config;

  // Queue the write operation
  return new Promise((resolve, reject) => {
    writeQueue.push({ config, resolve, reject });
    processWriteQueue();
  });
}

// Process write queue sequentially
async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;

  isWriting = true;
  const { config, resolve, reject } = writeQueue.shift();

  try {
    const yamlStr = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    await fs.writeFile(CONFIG_PATH, yamlStr, "utf8");
    resolve(true);
  } catch (e) {
    console.error("Error writing config:", e);
    reject(new Error("Failed to write config file"));
  } finally {
    isWriting = false;
    // Process next item in queue
    if (writeQueue.length > 0) {
      processWriteQueue();
    }
  }
}

// Add stream to go2rtc runtime
async function addStreamToRuntime(id, url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      streams: { [id]: url },
    });

    const options = {
      hostname: "localhost",
      port: 1984,
      path: "/api/config",
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`go2rtc API returned ${res.statusCode}`));
      }
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Remove stream from go2rtc runtime
async function removeStreamFromRuntime(id) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 1984,
      path: `/api/streams/${id}`,
      method: "DELETE",
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`go2rtc API returned ${res.statusCode}`));
      }
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

module.exports = {
  loadConfigSync,
  readConfig,
  writeConfig,
  addStreamToRuntime,
  removeStreamFromRuntime,
};
