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
import { fontFamilyOf, fontWeightOf, type FontWeight } from "@/lib/fonts";
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

  // Every font the overlay's text needs, each family and weight once. Renderers fill in the
  // default family, so elements without a stored font count too.
  const loadOverlayFonts = () => {
    if (!overlay) return null;

    // Keyed so a family used at two weights is only asked for once per weight.
    const fonts = new Map<string, { fontFamily: string; fontWeight: FontWeight }>();
    overlay.elements.forEach((element) => {
      const style = element.style as BaseElementStyle | null;
      const fontFamily = fontFamilyOf(style);
      const fontWeight = fontWeightOf(style);
      fonts.set(`${fontFamily}:${fontWeight}`, { fontFamily, fontWeight });
    });

    return Array.from(fonts, ([key, font]) => <FontLoader key={key} {...font} />);
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
