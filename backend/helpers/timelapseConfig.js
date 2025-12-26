const fs = require("fs").promises;
const path = require("path");

const TIMELAPSE_CONFIG_PATH = path.join(__dirname, "../timelapse.config.json");

// In-memory cache
let timelapseConfigCache = null;

async function loadTimelapseConfig() {
  if (timelapseConfigCache) return timelapseConfigCache;

  try {
    const raw = await fs.readFile(TIMELAPSE_CONFIG_PATH, "utf8");
    timelapseConfigCache = JSON.parse(raw);
  } catch (e) {
    // default config
    timelapseConfigCache = {
      intervalSeconds: 600, // 10 phút 1 hình
      periodValue: 1,
      periodUnit: "month",
      enabledCameraIds: [],
    };
    try {
      await fs.writeFile(
        TIMELAPSE_CONFIG_PATH,
        JSON.stringify(timelapseConfigCache, null, 2),
        "utf8"
      );
    } catch {
      // ignore
    }
  }

  // migrate cấu trúc cũ (period: "day" | "month" | "year")
  if (!timelapseConfigCache.periodValue || !timelapseConfigCache.periodUnit) {
    timelapseConfigCache.periodValue = 1;
    timelapseConfigCache.periodUnit = timelapseConfigCache.period || "month";
    delete timelapseConfigCache.period;
    await saveTimelapseConfig(timelapseConfigCache);
  }

  return timelapseConfigCache;
}

async function saveTimelapseConfig(config) {
  timelapseConfigCache = config;
  await fs.writeFile(
    TIMELAPSE_CONFIG_PATH,
    JSON.stringify(config, null, 2),
    "utf8"
  );
}

function getCurrentBucketId(periodValue, periodUnit) {
  const nowMs = Date.now();
  const unitMsMap = {
    hour: 3600 * 1000,
    day: 24 * 3600 * 1000,
    month: 30 * 24 * 3600 * 1000, // approx 30 ngày
    year: 365 * 24 * 3600 * 1000, // approx 365 ngày
  };
  const baseUnitMs = unitMsMap[periodUnit] || unitMsMap.month;
  const periodMs = Math.max(1, Number(periodValue) || 1) * baseUnitMs;
  const bucketIndex = Math.floor(nowMs / periodMs);
  return `${periodUnit}_${periodValue}_${bucketIndex}`;
}

module.exports = {
  loadTimelapseConfig,
  saveTimelapseConfig,
  getCurrentBucketId,
};
