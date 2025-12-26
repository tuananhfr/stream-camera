# Backend API

Backend API để quản lý camera configuration cho go2rtc.

## Features

- ✅ REST API để đọc/ghi file `go2rtc.yaml`
- ✅ Tự động chạy cả **Node.js API** và **go2rtc** cùng lúc
- ✅ Persistent camera storage

## Installation

```bash
npm install
```

## Usage

### Chạy tất cả (API + go2rtc):

```bash
npm start
```

Hoặc với auto-reload (development):

```bash
npm run dev
```

### Chạy riêng từng service:

**Chỉ chạy API:**

```bash
npm run api
```

**Chỉ chạy go2rtc:**

```bash
npm run go2rtc
```

## API Endpoints

### GET /api/cameras

Lấy danh sách tất cả cameras từ config file.

**Response:**

```json
[
  {
    "id": "camera_tuananh",
    "name": "Camera Tuananh",
    "type": "rtsp",
    "url": "rtsp://tuananh:tuananh123@192.168.0.156/1/stream1"
  }
]
```

### POST /api/cameras

Thêm camera mới vào config file.

**Request:**

```json
{
  "id": "camera_name",
  "url": "rtsp://user:pass@192.168.1.100/stream"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Camera added successfully"
}
```

### DELETE /api/cameras/:id

Xóa camera khỏi config file.

**Response:**

```json
{
  "success": true,
  "message": "Camera removed successfully"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

## Configuration

- **API Port:** 5000
- **go2rtc Port:** 1984
- **Config File:** `go2rtc.yaml`

## Logs

Logs có màu sắc để dễ phân biệt:

- 🔵 **API logs** (màu xanh blue)
- 🟢 **go2rtc logs** (màu xanh green)
