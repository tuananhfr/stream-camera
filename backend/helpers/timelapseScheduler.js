const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { readConfig } = require("./config");
const { formatTime, normalizeName, ensureDir } = require("./utils");
const { runFfmpeg } = require("./ffmpeg");
const {
  loadTimelapseConfig,
  getCurrentBucketId,
} = require("./timelapseConfig");

const TIMELAPSE_DIR = path.join(__dirname, "../timelapse");

// In-memory timelapse state
const timelapseState = {}; // cameraId -> { currentPeriod, lastCaptureAt, frameCount, startTime, jobId }
const finalizingJobs = new Set(); // Track đang finalize để tránh duplicate

async function finalizePeriodTimelapse(cameraId, oldJobId, startTime) {
  // Kiểm tra xem đang finalize job này chưa để tránh duplicate
  if (finalizingJobs.has(oldJobId)) {
    console.log(`Job ${oldJobId} is already being finalized, skipping`);
    return;
  }

  finalizingJobs.add(oldJobId);

  try {
    // Get camera name from metadata
    const config = readConfig();
    const metadata = config.metadata || {};
    const cameraMeta = metadata[cameraId] || {};
    const cameraName = cameraMeta.name || cameraId;
    const normalizedName = normalizeName(cameraName);

    // Get start and end time
    const endTime = Date.now();
    const timeStart = formatTime(startTime || Date.now());
    const timeEnd = formatTime(endTime);

    // Create new job ID with format: name_time_debut_time_fin
    const newJobId = `${normalizedName}_${timeStart}_${timeEnd}`;
    const oldJobDir = path.join(TIMELAPSE_DIR, oldJobId);
    const newJobDir = path.join(TIMELAPSE_DIR, newJobId);
    const framesDir = path.join(oldJobDir, "frames");
    const outputVideo = path.join(newJobDir, `${newJobId}.mp4`);

    // nếu không có frame nào thì bỏ qua
    if (!fsSync.existsSync(framesDir)) {
      console.log(`No frames directory for ${oldJobId}, skipping finalize`);
      return;
    }
    const files = fsSync
      .readdirSync(framesDir)
      .filter((f) => f.endsWith(".jpg"));
    if (files.length === 0) {
      console.log(`No frames found for ${oldJobId}, skipping finalize`);
      return;
    }

    console.log(
      `Finalizing timelapse ${oldJobId} -> ${newJobId} with ${files.length} frames`
    );

    await ensureDir(newJobDir);

    // Sort files by name để đảm bảo thứ tự
    files.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

    // Move frames to new directory first if needed
    const newFramesDir = path.join(newJobDir, "frames");
    let workingFramesDir = framesDir;
    if (oldJobDir !== newJobDir && fsSync.existsSync(framesDir)) {
      try {
        await fs.rename(framesDir, newFramesDir);
        workingFramesDir = newFramesDir;
      } catch (e) {
        console.warn("Failed to move frames directory, copying instead:", e);
        await fs.cp(framesDir, newFramesDir, { recursive: true });
        workingFramesDir = newFramesDir;
        await fs.rm(framesDir, { recursive: true, force: true });
      }
    }

    // Rename files to frame_0001.jpg, frame_0002.jpg... để match pattern
    // Đơn giản hóa: chỉ rename nếu cần, không verify phức tạp
    const filesInNewDir = fsSync.existsSync(workingFramesDir)
      ? fsSync.readdirSync(workingFramesDir).filter((f) => f.endsWith(".jpg"))
      : [];
    for (let i = 0; i < filesInNewDir.length; i++) {
      const oldPath = path.join(workingFramesDir, filesInNewDir[i]);
      const newName = `frame_${String(i + 1).padStart(4, "0")}.jpg`;
      const newPath = path.join(workingFramesDir, newName);
      if (oldPath !== newPath) {
        try {
          if (fsSync.existsSync(newPath)) {
            await fs.unlink(newPath);
          }
          await fs.rename(oldPath, newPath);
        } catch (e) {
          console.warn(
            `Failed to rename ${filesInNewDir[i]} to ${newName}:`,
            e
          );
        }
      }
    }

    // Build video đơn giản giống manual timelapse (không có các tham số phức tạp)
    const finalFrameCount = filesInNewDir.length;
    console.log(`Building video with ${finalFrameCount} frames`);
    await runFfmpeg(
      [
        "-y",
        "-framerate",
        "30",
        "-i",
        path.join(workingFramesDir, "frame_%04d.jpg"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outputVideo,
      ],
      600000
    ); // 10 phút timeout

    console.log(
      `Timelapse video created: ${outputVideo} (${finalFrameCount} frames, 30fps)`
    );

    // Cleanup old directory if different from new
    if (oldJobDir !== newJobDir && fsSync.existsSync(oldJobDir)) {
      try {
        await fs.rm(oldJobDir, { recursive: true, force: true });
        console.log(`Cleaned up old directory ${oldJobDir}`);
      } catch (e) {
        console.warn("Failed to cleanup old timelapse directory:", e);
      }
    }

    // xoá frame sau khi build video (delay một chút để đảm bảo file đã được ghi xong)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      if (fsSync.existsSync(newFramesDir)) {
        await fs.rm(newFramesDir, { recursive: true, force: true });
        console.log(`Cleaned up frames directory for ${newJobId}`);
      }
    } catch (e) {
      console.warn("Failed to cleanup auto timelapse frames:", e);
    }
  } catch (error) {
    console.error(`Error finalizing timelapse ${oldJobId}:`, error);
    throw error;
  } finally {
    // Luôn remove khỏi set dù thành công hay thất bại
    finalizingJobs.delete(oldJobId);
  }
}

async function startTimelapseScheduler() {
  const timelapseConfigCache = await loadTimelapseConfig();

  // chạy mỗi 5 giây, nhưng chỉ chụp khi đủ intervalSeconds
  setInterval(async () => {
    const config = await loadTimelapseConfig();
    if (!config) return;
    const {
      intervalSeconds,
      enabledCameraIds,
      periodValue = 1,
      periodUnit = "month",
    } = config;
    if (!intervalSeconds || intervalSeconds <= 0) return;
    if (!enabledCameraIds || enabledCameraIds.length === 0) return;

    const configData = readConfig();
    const streams = configData.streams || {};
    const now = Date.now();

    for (const cameraId of enabledCameraIds) {
      const source = streams[cameraId];
      if (!source) continue;

      let state = timelapseState[cameraId];
      if (!state) {
        state = {
          currentPeriod: null,
          lastCaptureAt: 0,
          frameCount: 0,
          startTime: null,
          jobId: null,
        };
      }

      // Get camera name from metadata
      const metadata = configData.metadata || {};
      const cameraMeta = metadata[cameraId] || {};
      const cameraName = cameraMeta.name || cameraId;
      const normalizedName = normalizeName(cameraName);

      const currentPeriod = getCurrentBucketId(periodValue, periodUnit);
      if (state.currentPeriod && state.currentPeriod !== currentPeriod) {
        // kết thúc chu kỳ cũ -> build video (chạy background, không block)
        console.log(
          `[Timelapse] Period changed for camera ${cameraId}: ${state.currentPeriod} -> ${currentPeriod}. Finalizing...`
        );
        // Chạy finalize trong background, không await để không block setInterval
        // Pass jobId to finalize function
        if (state.jobId) {
          finalizePeriodTimelapse(cameraId, state.jobId, state.startTime).catch(
            (e) => {
              console.error(
                `Finalize timelapse failed for ${cameraId} jobId ${state.jobId}:`,
                e
              );
            }
          );
        }
        // Reset state ngay lập tức để bắt đầu period mới
        state.currentPeriod = currentPeriod;
        state.lastCaptureAt = 0;
        state.frameCount = 0;
        state.startTime = now; // Set start time for new period
        const timeStart = formatTime(now);
        state.jobId = `${normalizedName}_${timeStart}`;
        console.log(
          `[Timelapse] Started new period ${currentPeriod} for camera ${cameraId}, jobId: ${state.jobId}`
        );
      } else if (!state.currentPeriod) {
        state.currentPeriod = currentPeriod;
        state.frameCount = 0;
        state.startTime = now; // Set start time for new period
        const timeStart = formatTime(now);
        state.jobId = `${normalizedName}_${timeStart}`;
        console.log(
          `[Timelapse] Started period ${currentPeriod} for camera ${cameraId}, jobId: ${state.jobId}`
        );
      }

      if (
        state.lastCaptureAt &&
        now - state.lastCaptureAt < intervalSeconds * 1000
      ) {
        timelapseState[cameraId] = state;
        continue;
      }

      // chụp 1 frame
      // Use jobId from state (already created when period started)
      const jobId = state.jobId;
      if (!jobId) {
        console.error(`No jobId for camera ${cameraId}, skipping capture`);
        continue;
      }
      const jobDir = path.join(TIMELAPSE_DIR, jobId);
      const framesDir = path.join(jobDir, "frames");

      try {
        await ensureDir(framesDir);
        // Đếm số frame hiện có để đặt tên đúng thứ tự
        const existingFrames = fsSync.existsSync(framesDir)
          ? fsSync.readdirSync(framesDir).filter((f) => f.endsWith(".jpg"))
          : [];
        state.frameCount = existingFrames.length;
        const frameName = `frame_${String(state.frameCount + 1).padStart(
          4,
          "0"
        )}.jpg`;

        // Use go2rtc stream instead of direct RTSP for better performance
        // Go2rtc has already decoded the stream, so we can use it directly
        // Format: http://localhost:1984/api/frame.jpeg?src={cameraId}
        const go2rtcSnapshotUrl = `http://localhost:1984/api/frame.jpeg?src=${encodeURIComponent(
          cameraId
        )}`;

        await runFfmpeg([
          "-y",
          "-i",
          go2rtcSnapshotUrl,
          "-frames:v",
          "1",
          "-q:v",
          "2", // Quality 2 (high quality)
          path.join(framesDir, frameName),
        ]);
        state.lastCaptureAt = now;
        state.frameCount++;
        timelapseState[cameraId] = state;
      } catch (e) {
        console.error(`Capture frame failed for camera ${cameraId}:`, e);
      }
    }
  }, 5000);
}

module.exports = {
  startTimelapseScheduler,
  finalizePeriodTimelapse,
  timelapseState,
};
