# Camera Stream Monitor

Web application để stream nhiều camera đồng thời sử dụng **go2rtc** và **React**.

## Tính năng

- ✅ Stream đồng thời nhiều cameras
- ✅ Hỗ trợ RTSP cameras và public streams
- ✅ WebRTC streaming với độ trễ thấp
- ✅ Giao diện responsive với Bootstrap 5
- ✅ Thêm/xóa cameras qua UI
- ✅ Tối ưu cho Raspberry Pi 5

## Công nghệ

**Backend:**
- [go2rtc](https://github.com/AlexxIT/go2rtc) - Universal camera streaming server

**Frontend:**
- React 18
- TypeScript
- Vite
- Bootstrap 5

## Yêu cầu

- Node.js 18+
- go2rtc binary

## Cài đặt

### 1. Tải go2rtc

**Windows:**
```bash
# Download từ https://github.com/AlexxIT/go2rtc/releases
# Hoặc dùng PowerShell:
curl -Lo go2rtc.exe https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_win64.exe
```

**Linux/Raspberry Pi:**
```bash
# ARM64 (Raspberry Pi 5)
wget https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_arm64 -O go2rtc
chmod +x go2rtc

# AMD64
wget https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -O go2rtc
chmod +x go2rtc
```

### 2. Cài đặt dependencies

```bash
cd frontend
npm install
```

## Chạy ứng dụng

### Development

**Terminal 1 - Chạy go2rtc:**
```bash
# Windows
go2rtc.exe -c go2rtc.yaml

# Linux/Mac
./go2rtc -c go2rtc.yaml
```

**Terminal 2 - Chạy frontend:**
```bash
cd frontend
npm run dev
```

Mở trình duyệt: http://localhost:5173

### Production Build

```bash
cd frontend
npm run build
```

Build output sẽ ở folder `frontend/dist`

## Sử dụng

### Thêm Camera

1. Click nút **"Add Camera"**
2. Nhập tên camera (VD: "Front Door", "Living Room")
3. Chọn loại camera:
   - **RTSP Camera**: Camera IP trong mạng LAN
   - **Public Stream**: Camera công khai trên internet
4. Nhập URL:
   - RTSP: `rtsp://username:password@192.168.1.100:554/stream`
   - Public: `https://example.com/stream.m3u8`
5. Click **"Add Camera"**

### Xóa Camera

Click nút **X** đỏ ở góc trên phải của mỗi camera.

## Cấu hình go2rtc

File `go2rtc.yaml` có thể tùy chỉnh:

```yaml
api:
  listen: ":1984"  # API port

webrtc:
  listen: ":8555"  # WebRTC port

streams:
  # Có thể định nghĩa cameras cố định tại đây
  camera1: rtsp://192.168.1.100/stream

log:
  level: info
```

## Deploy trên Raspberry Pi 5

### 1. Cài đặt Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone project

```bash
git clone <your-repo>
cd stream-camera
```

### 3. Build frontend

```bash
cd frontend
npm install
npm run build
```

### 4. Chạy go2rtc như một service

Tạo file `/etc/systemd/system/go2rtc.service`:

```ini
[Unit]
Description=go2rtc Camera Streaming
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/stream-camera
ExecStart=/home/pi/stream-camera/go2rtc -c /home/pi/stream-camera/go2rtc.yaml
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable và start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable go2rtc
sudo systemctl start go2rtc
```

### 5. Serve frontend với nginx

```bash
sudo apt install nginx

# Copy build files
sudo cp -r frontend/dist/* /var/www/html/

# Config nginx proxy cho go2rtc API
sudo nano /etc/nginx/sites-available/default
```

Thêm vào config:

```nginx
location /api/ {
    proxy_pass http://localhost:1984/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Restart nginx:

```bash
sudo systemctl restart nginx
```

## Troubleshooting

### Camera không hiển thị

1. Kiểm tra go2rtc đang chạy: http://localhost:1984
2. Kiểm tra URL camera có đúng không
3. Mở Developer Console (F12) xem lỗi
4. Thử stream trực tiếp trên go2rtc UI: http://localhost:1984

### CORS errors

Nếu frontend và go2rtc chạy khác port, thêm CORS config vào `go2rtc.yaml`:

```yaml
api:
  listen: ":1984"
  origin: "*"
```

### WebRTC không kết nối

1. Kiểm tra firewall mở port 8555 (WebRTC)
2. Kiểm tra STUN server trong VideoPlayer.tsx
3. Thử dùng MSE thay vì WebRTC (sửa code)

## License

MIT
