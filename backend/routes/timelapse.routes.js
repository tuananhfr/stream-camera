const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { spawn } = require("child_process");
const { readConfig } = require("../helpers/config");

const router = express.Router();

// Constants
const TIMELAPSE_DIR = path.join(__dirname, "../timelapse");
const UPLOAD_DIR = path.join(__dirname, "../uploads");
const TIMELAPSE_CONFIG_PATH = path.join(__dirname, "../timelapse.config.json");

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `upload_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// Helper functions
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function runFfmpeg(args = [], timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrOutput = "";
    let timeoutId = null;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        console.error(`FFmpeg timeout after ${timeoutMs}ms, killing process`);
        try {
          ff.kill("SIGKILL");
        } catch (e) {
          console.error("Failed to kill ffmpeg:", e);
        }
        reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    ff.stdout.on("data", (data) => {
      // Ignore stdout
    });

    ff.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    ff.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    ff.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (code === 0) return resolve(true);
      const errorMsg = stderrOutput || `ffmpeg exited with code ${code}`;
      reject(new Error(errorMsg));
    });
  });
}

// POST /api/timelapse - create timelapse video
router.post("/", upload.single("file"), async (req, res) => {
  const { source, intervalSeconds } = req.body || {};
  const interval = Number(intervalSeconds);
  const filePath = req.file ? req.file.path : null;
  const effectiveSource = filePath || source;

  if (!effectiveSource) {
    return res.status(400).json({ error: "Missing source or file" });
  }
  if (!interval || interval <= 0) {
    return res.status(400).json({ error: "intervalSeconds must be > 0" });
  }

  const jobId = `timelapse_${Date.now()}`;
  const jobDir = path.join(TIMELAPSE_DIR, jobId);
  const framesDir = path.join(jobDir, "frames");
  const outputVideo = path.join(jobDir, `${jobId}.mp4`);

  try {
    await ensureDir(framesDir);

    // Step 1: extract frames
    await runFfmpeg([
      "-y",
      "-i",
      effectiveSource,
      "-vf",
      `fps=1/${interval}`,
      path.join(framesDir, "frame_%04d.jpg"),
    ]);

    // Step 2: stitch frames back into a timelapse video
    await runFfmpeg([
      "-y",
      "-framerate",
      "30",
      "-i",
      path.join(framesDir, "frame_%04d.jpg"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputVideo,
    ]);

    // Cleanup extracted frames
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn("Failed to cleanup timelapse frames:", cleanupError);
    }

    // Remove uploaded file
    if (filePath) {
      try {
        await fs.rm(filePath, { force: true });
      } catch (cleanupError) {
        console.warn("Failed to remove uploaded source file:", cleanupError);
      }
    }

    const publicUrl = `/timelapse/${jobId}/${jobId}.mp4`;
    res.json({ success: true, videoUrl: publicUrl });
  } catch (error) {
    console.error("Timelapse error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create timelapse" });
  }
});

// GET /api/timelapse - list timelapse videos
router.get("/", async (req, res) => {
  try {
    await ensureDir(TIMELAPSE_DIR);
    const files = await fs.readdir(TIMELAPSE_DIR, { withFileTypes: true });
    const timelapseList = [];

    for (const dirent of files) {
      if (dirent.isDirectory()) {
        const jobId = dirent.name;
        const videoPath = path.join(TIMELAPSE_DIR, jobId, `${jobId}.mp4`);

        try {
          const stats = await fs.stat(videoPath);
          timelapseList.push({
            id: jobId,
            videoUrl: `/timelapse/${jobId}/${jobId}.mp4`,
            createdAt: stats.birthtime || stats.mtime,
          });
        } catch (err) {
          // Video doesn't exist, skip
        }
      }
    }

    // Sort by creation time descending
    timelapseList.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ success: true, data: timelapseList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/timelapse/config - get timelapse config
router.get("/config", async (req, res) => {
  try {
    let config = {
      intervalSeconds: 600,
      periodValue: 1,
      periodUnit: "month",
      enabledCameraIds: [],
    };

    try {
      const data = await fs.readFile(TIMELAPSE_CONFIG_PATH, "utf8");
      config = JSON.parse(data);
    } catch (err) {
      // File doesn't exist, use default
    }

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/timelapse/config - update timelapse config
router.put("/config", async (req, res) => {
  try {
    const { intervalSeconds, periodValue, periodUnit, enabledCameraIds } =
      req.body;

    const config = {
      intervalSeconds: intervalSeconds || 600,
      periodValue: periodValue || 1,
      periodUnit: periodUnit || "month",
      enabledCameraIds: enabledCameraIds || [],
    };

    await fs.writeFile(
      TIMELAPSE_CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf8"
    );

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/timelapse/finalize/:cameraId
router.post("/finalize/:cameraId", async (req, res) => {
  // This endpoint is for auto-timelapse finalization
  // Logic depends on timelapseState which is in server.js
  // For now, return not implemented
  res.status(501).json({
    error: "Auto-timelapse finalization not yet migrated to routes"
  });
});

module.exports = router;
