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

    const fetchInitialData = async () => {
      try {
        const response = await fetch(`/api/public/overlays/${overlayId}`);
        if (response.ok) {
          const data = await response.json();
          setOverlay(data);
        }
      } catch (error) {
        console.error("Failed to fetch initial overlay data:", error);
      }
    };

    fetchInitialData();

    // Reconnects on its own (an OBS source can't be reloaded by hand), and refetches after
    // a drop to pick up whatever was broadcast while the connection was down.
    return connectOverlaySocket(overlayId, {
      onOverlay: setOverlay,
      onReconnect: fetchInitialData,
    });
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
    return Array.from(fonts).map((fontString, index) => {
      const [fontFamily, fontWeight] = fontString.split(":");
      return <FontLoader key={index} fontFamily={fontFamily} fontWeight={fontWeight} />;
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
