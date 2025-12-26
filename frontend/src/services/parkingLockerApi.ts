import type { Locker } from "../types/locker";

const buildHeaders = () => ({
  "Content-Type": "application/json",
});

export const createParkingLockerApi = (baseURL: string) => {
  const withBase = (path: string) => `${baseURL}${path}`;

  return {
    async getLockers(params?: { connected?: boolean; limit?: number }) {
      const url = new URL(withBase("/api/lockers"));
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const res = await fetch(url.toString(), { headers: buildHeaders() });
      if (!res.ok) {
        throw new Error("Không tải được danh sách locker");
      }
      const data = await res.json();
      return data.data as Locker[];
    },

    async controlLocker(
      lockId: string,
      payload: { action: "open" | "close" | "stop" | "normal"; mode?: string }
    ) {
      const res = await fetch(
        withBase(`/api/lockers/${lockId}/control`),
        {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Gửi lệnh điều khiển thất bại");
      }
      return res.json();
    },

    async setLockAttribute(
      lockId: string,
      payload: { up_protect?: number; down_protect?: number }
    ) {
      const res = await fetch(
        withBase(`/api/lockers/${lockId}/set-attribute`),
        {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Cấu hình bảo vệ thất bại");
      }
      return res.json();
    },

    async setFreeTime(lockId: string, payload: { time: number }) {
      const res = await fetch(withBase(`/api/lockers/${lockId}/free-time`), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Thiết lập free time thất bại");
      }
      return res.json();
    },

    async setWarningTime(lockId: string, payload: { time: number }) {
      const res = await fetch(withBase(`/api/lockers/${lockId}/warning-time`), {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Thiết lập warning time thất bại");
      }
      return res.json();
    },
  };
};

export type ParkingLockerApi = ReturnType<typeof createParkingLockerApi>;

