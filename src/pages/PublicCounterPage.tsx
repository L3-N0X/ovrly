import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import OverlayCanvas from "../components/overlay/OverlayCanvas";
import FontLoader from "../components/FontLoader";
import type { PrismaOverlay, BaseElementStyle } from "@/lib/types";
import { connectOverlaySocket } from "@/lib/overlaySocket";

const PublicCounterPage = () => {
  const { overlayId } = useParams();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);

  useEffect(() => {
    if (!overlayId) return;

    let disposed = false;
    // Bumped by every broadcast: a fetch that started before one arrived holds older data
    // and must not overwrite it.
    let broadcastCount = 0;

    const fetchOverlay = async () => {
      const startedAt = broadcastCount;
      try {
        const response = await fetch(`/api/public/overlays/${overlayId}`);
        if (response.ok) {
          const data = await response.json();
          if (!disposed && startedAt === broadcastCount) setOverlay(data);
        }
      } catch (error) {
        console.error("Failed to fetch overlay data:", error);
      }
    };

    // Fetched right away so the overlay shows up even if the WebSocket can't connect.
    fetchOverlay();

    // Reconnects on its own (an OBS source can't be reloaded by hand), and refetches whenever
    // it (re)connects to pick up whatever was broadcast while it wasn't connected.
    const disconnect = connectOverlaySocket(overlayId, {
      onOverlay: (updated) => {
        broadcastCount++;
        setOverlay(updated);
      },
      onOpen: fetchOverlay,
    });

    return () => {
      disposed = true;
      disconnect();
    };
  }, [overlayId]);

  // Function to extract and load fonts from overlay data
  const loadOverlayFonts = () => {
    if (!overlay) return null;

    // Extract unique font families and weights from overlay elements
    const fonts = new Set<string>();

    // Check individual elements for font families and weights
    if (overlay.elements) {
      overlay.elements.forEach((element) => {
        // Check if the element style exists before accessing its properties
        if (element.style) {
          // Type guard to check if the style has fontFamily property
          const elementStyle = element.style as BaseElementStyle;
          if (elementStyle.fontFamily) {
            // Check if style has fontWeight (even though it's not in the type)
            const fontWeight = (elementStyle as { fontWeight?: string }).fontWeight || "400";
            fonts.add(`${elementStyle.fontFamily}:${fontWeight}`);
          }
        }
      });
    }

    // Render FontLoader for each unique font family and weight
    return Array.from(fonts).map((fontString) => {
      const [fontFamily, fontWeight] = fontString.split(":");
      return <FontLoader key={fontString} fontFamily={fontFamily} fontWeight={fontWeight} />;
    });
  };

  if (!overlay) {
    // Render a blank 800x600 box while loading
    return <div style={{ width: "800px", height: "600px" }} />;
  }

  return (
    <>
      {loadOverlayFonts()}
      <OverlayCanvas overlay={overlay} />
    </>
  );
};

export default PublicCounterPage;
