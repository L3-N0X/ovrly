import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import OverlayCanvas from "../components/overlay/OverlayCanvas";
import FontLoader from "../components/FontLoader";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  type PrismaOverlay,
  type BaseElementStyle,
} from "@/lib/types";
import { connectOverlaySocket } from "@/lib/overlaySocket";

const PublicCounterPage = () => {
  const { overlayId } = useParams();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);

  useEffect(() => {
    if (!overlayId) return;

    let disposed = false;
    // Snapshots can arrive out of order (a fetch that started before a broadcast, two
    // broadcasts overtaking each other); the revision tells which one is newer.
    let revision = -1;
    const show = (data: PrismaOverlay) => {
      if (disposed || data.revision < revision) return;
      revision = data.revision;
      setOverlay(data);
    };

    const fetchOverlay = async () => {
      try {
        const response = await fetch(`/api/public/overlays/${overlayId}`);
        if (response.ok) show(await response.json());
      } catch (error) {
        console.error("Failed to fetch overlay data:", error);
      }
    };

    // Fetched right away so the overlay shows up even if the WebSocket can't connect.
    fetchOverlay();

    // Reconnects on its own (an OBS source can't be reloaded by hand), and refetches whenever
    // it (re)connects to pick up whatever was broadcast while it wasn't connected.
    const disconnect = connectOverlaySocket(overlayId, {
      onOverlay: show,
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
    // A blank box of the default size while loading, so OBS doesn't flash a collapsed source.
    return <div style={{ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT }} />;
  }

  return (
    <>
      {loadOverlayFonts()}
      <OverlayCanvas overlay={overlay} />
    </>
  );
};

export default PublicCounterPage;
