const multer = require("multer");
const fsSync = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "../uploads");

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

module.exports = {
  upload,
};
