import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import OverlayCanvas from "../components/overlay/OverlayCanvas";
import type { PrismaOverlay } from "@/lib/types";

const PublicCounterPage = () => {
  const { overlayId } = useParams();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);

  useEffect(() => {
    if (!overlayId) return;

    const fetchInitialData = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/public/overlays/${overlayId}`);
        if (response.ok) {
          const data = await response.json();
          setOverlay(data);
        }
      } catch (error) {
        console.error("Failed to fetch initial overlay data:", error);
      }
    };

    fetchInitialData();

    const ws = new WebSocket(`ws://localhost:3000/ws?overlayId=${overlayId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setOverlay(data);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed. Reconnecting...");
      // Implement reconnection logic here if needed
    };

    return () => {
      ws.close();
    };
  }, [overlayId]);

  if (!overlay) {
    // Render a blank 800x600 box while loading
    return <div style={{ width: "800px", height: "600px" }} />;
  }

  return <OverlayCanvas overlay={overlay} />;
};

export default PublicCounterPage;
