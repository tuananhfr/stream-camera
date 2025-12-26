const { spawn } = require("child_process");

function runFfmpeg(args = [], timeoutMs = 300000) {
  // Default timeout 5 phút để tránh treo vô hạn
  return new Promise((resolve, reject) => {
    // Redirect stdout/stderr để không spam log
    // Chỉ log error nếu có lỗi
    const ff = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"], // stdin: ignore, stdout: pipe, stderr: pipe
    });

    let stderrOutput = "";
    let timeoutId = null;

    // Set timeout để kill process nếu quá lâu
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
      // Collect stderr để log nếu có lỗi
      stderrOutput += data.toString();
    });

    ff.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    ff.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (code === 0) return resolve(true);
      // Chỉ log error khi thực sự có lỗi
      const errorMsg = stderrOutput || `ffmpeg exited with code ${code}`;
      reject(new Error(errorMsg));
    });
  });
}

module.exports = {
  runFfmpeg,
};
