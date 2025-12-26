import { useState, useEffect } from "react";
import { CENTRAL_URL } from "../config";
import useConnectionStatus from "./useConnectionStatus";

/**
 * Custom hook để quản lý stats (header info)
 * - Fetch lần đầu + interval fallback
 * - Lắng nghe WebSocket /ws/history để cập nhật realtime khi có thay đổi history
 * - Auto-reconnect khi backend down → up
 */
const useStats = () => {
  const [stats, setStats] = useState(null);
  const { isConnected } = useConnectionStatus();
  const [previousConnection, setPreviousConnection] = useState(null);

  //Auto-refetch stats khi backend reconnect (CHI khi false → true, KHONG phai null → true)
  useEffect(() => {
    if (
      isConnected === true &&
      previousConnection === false &&
      previousConnection !== null
    ) {
      console.log("[Stats] Backend reconnected, reloading stats...");
      fetchStats();
    }
    if (isConnected !== null) {
      setPreviousConnection(isConnected);
    }
  }, [isConnected, previousConnection]);

  const fetchStats = async () => {
    try {
      //Goi API stats chuyen biet - adapt cho backend Node.js
      const response = await fetch(`${CENTRAL_URL}/api/camera-ai/stats`);
      const data = await response.json();
      // Backend Node.js trả về: { total, in_parking, total_out }
      setStats({
        entries_today: data.total || 0,
        exits_today: data.total_out || 0,
        vehicles_in_parking: data.in_parking || 0,
        revenue_today: 0, // Backend chưa có revenue
      });
    } catch (err) {
      //Silent fail
    }
  };

  useEffect(() => {
    //Fetch stats NGAY de co UI nhanh
    fetchStats();

    //WebSocket lang nghe history_update → cap nhat stats realtime
    const wsUrl = CENTRAL_URL.replace("http", "ws") + "/ws/camera-ai";
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          //console.log("[Stats] WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "history_update") {
              //Khi co thay doi history (vao/ra/sua/xoa) → refetch stats
              fetchStats();
            }
          } catch (err) {
            console.error("[Stats] WebSocket message error:", err);
          }
        };

        ws.onclose = () => {
          //console.log("[Stats] WebSocket disconnected, reconnecting...");
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          console.error("[Stats] WebSocket error:", err);
        };
      } catch (err) {
        console.error("[Stats] WebSocket connection error:", err);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  return { stats };
};

export default useStats;
