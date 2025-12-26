import { useState, useEffect } from "react";
import { CENTRAL_URL } from "../config";

/**
 * Custom hook để detect backend type (edge vs central)
 * - Node.js backend luôn là "central" mode
 * - Edge cameras kết nối vào central qua WebSocket
 */
const useBackendType = () => {
  const [backendType, setBackendType] = useState(null); //"edge" | "central" | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectBackendType = async () => {
      try {
        setLoading(true);
        const url = `${CENTRAL_URL}/api/camera-ai/status`;
        console.log("[useBackendType] Fetching from URL:", url);
        const response = await fetch(url);
        console.log("[useBackendType] Response status:", response.status);
        const data = await response.json();

        if (data.success && data.backend_type) {
          setBackendType(data.backend_type);
        } else {
          //Default to central
          setBackendType("central");
        }
      } catch (err) {
        console.error("[useBackendType] Failed to detect backend type:", err);
        //Default to central neu co loi
        setBackendType("central");
      } finally {
        setLoading(false);
      }
    };

    detectBackendType();
  }, []);

  return {
    backendType,
    loading,
    isEdge: backendType === "edge",
    isCentral: backendType === "central",
  };
};

export default useBackendType;
