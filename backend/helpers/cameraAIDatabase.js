const Database = require("better-sqlite3");
const path = require("path");

class CameraAIDatabase {
  constructor(dbPath = path.join(__dirname, "../camera-ai.db")) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initTables();
  }

  initTables() {
    // Cameras table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'ENTRY',
        status TEXT DEFAULT 'offline',
        last_heartbeat TEXT,
        events_sent INTEGER DEFAULT 0,
        events_failed INTEGER DEFAULT 0,
        location TEXT
      )
    `);

    // Parking history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parking_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE,
        plate_id TEXT NOT NULL,
        plate_view TEXT NOT NULL,
        entry_time TEXT NOT NULL,
        exit_time TEXT,
        duration TEXT,
        fee REAL,
        status TEXT DEFAULT 'IN',
        camera_name TEXT,
        location TEXT,
        is_anomaly INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_id ON parking_history(event_id);
      CREATE INDEX IF NOT EXISTS idx_plate_id ON parking_history(plate_id);
      CREATE INDEX IF NOT EXISTS idx_status ON parking_history(status);
      CREATE INDEX IF NOT EXISTS idx_entry_time ON parking_history(entry_time);
    `);
  }

  // ========== Camera Methods ==========

  upsertCamera(cameraData) {
    const stmt = this.db.prepare(`
      INSERT INTO cameras (id, name, type, status, last_heartbeat, events_sent, events_failed, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        status = excluded.status,
        last_heartbeat = excluded.last_heartbeat,
        events_sent = excluded.events_sent,
        events_failed = excluded.events_failed,
        location = excluded.location
    `);

    return stmt.run(
      cameraData.id,
      cameraData.name,
      cameraData.type || "ENTRY",
      cameraData.status || "offline",
      cameraData.last_heartbeat || new Date().toISOString(),
      cameraData.events_sent || 0,
      cameraData.events_failed || 0,
      cameraData.location || null
    );
  }

  getAllCameras() {
    return this.db.prepare("SELECT * FROM cameras ORDER BY id").all();
  }

  updateCameraHeartbeat(cameraId, status = "online") {
    const stmt = this.db.prepare(`
      UPDATE cameras
      SET status = ?, last_heartbeat = ?
      WHERE id = ?
    `);
    return stmt.run(status, new Date().toISOString(), cameraId);
  }

  // ========== Parking History Methods ==========

  createEntry(entryData) {
    const stmt = this.db.prepare(`
      INSERT INTO parking_history (
        event_id, plate_id, plate_view, entry_time, camera_name, location, is_anomaly
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entryData.event_id,
      entryData.plate_id,
      entryData.plate_view,
      entryData.entry_time,
      entryData.camera_name || null,
      entryData.location || null,
      entryData.is_anomaly ? 1 : 0
    );

    return result.lastInsertRowid;
  }

  updateExit(plateId, exitData) {
    const stmt = this.db.prepare(`
      UPDATE parking_history
      SET exit_time = ?, duration = ?, fee = ?, status = 'OUT'
      WHERE plate_id = ? AND status = 'IN'
    `);

    return stmt.run(
      exitData.exit_time,
      exitData.duration || null,
      exitData.fee || null,
      plateId
    );
  }

  findVehicleInParking(plateId) {
    return this.db
      .prepare(
        "SELECT * FROM parking_history WHERE plate_id = ? AND status = 'IN' ORDER BY id DESC LIMIT 1"
      )
      .get(plateId);
  }

  getHistory(options = {}) {
    const {
      limit = 100,
      offset = 0,
      search = null,
      status = null,
      in_parking_only = false,
    } = options;

    let query = "SELECT * FROM parking_history WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND (plate_id LIKE ? OR plate_view LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (in_parking_only) {
      query += " AND status = 'IN'";
    }

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.db.prepare(query).all(...params);
  }

  getStats() {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'IN' THEN 1 ELSE 0 END) as in_parking,
        SUM(CASE WHEN status = 'OUT' THEN 1 ELSE 0 END) as total_out
      FROM parking_history
    `
      )
      .get();

    return {
      total: stats.total || 0,
      in_parking: stats.in_parking || 0,
      total_out: stats.total_out || 0,
    };
  }

  updateHistoryEntry(historyId, plateId, plateView) {
    const stmt = this.db.prepare(`
      UPDATE parking_history
      SET plate_id = ?, plate_view = ?
      WHERE id = ?
    `);
    return stmt.run(plateId, plateView, historyId);
  }

  deleteHistoryEntry(historyId) {
    const stmt = this.db.prepare("DELETE FROM parking_history WHERE id = ?");
    return stmt.run(historyId);
  }

  eventExists(eventId) {
    const result = this.db
      .prepare("SELECT id FROM parking_history WHERE event_id = ? LIMIT 1")
      .get(eventId);
    return !!result;
  }

  close() {
    this.db.close();
  }
}

module.exports = CameraAIDatabase;
