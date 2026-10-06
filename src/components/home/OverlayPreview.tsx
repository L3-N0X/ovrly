import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";
import { loadFont } from "@/lib/fonts";
import {
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  type BaseElementStyle,
  type PrismaOverlay,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// A live, read-only thumbnail of an overlay. It is only rendered once it scrolls into view,
// so a long list doesn't mount (and tick the timers of) every overlay at once.
const OverlayPreview: React.FC<{ overlay: PrismaOverlay; className?: string }> = ({
  overlay,
  className,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => setScale(frame.clientWidth / OVERLAY_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || isVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { rootMargin: "200px" }
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const fonts = new Set(
      overlay.elements
        .map((element) => (element.style as BaseElementStyle | null)?.fontFamily)
        .filter((family): family is string => !!family)
    );
    fonts.forEach((family) =>
      loadFont(family).catch((error) => console.error(`Failed to load font: ${family}`, error))
    );
  }, [overlay.elements, isVisible]);

  return (
    <div
      ref={frameRef}
      aria-hidden
      // `inert` keeps bingo cells and the like out of the tab order and away from the pointer.
      inert
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden bg-neutral-900 select-none",
        className
      )}
      style={{
        // Transparent parts of an overlay are shown as a checkerboard, like in OBS or Figma.
        backgroundImage:
          "linear-gradient(45deg, rgb(255 255 255 / 0.04) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.04) 75%), linear-gradient(45deg, rgb(255 255 255 / 0.04) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.04) 75%)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 12px 12px",
      }}
    >
      {isVisible && scale > 0 && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, transform: `scale(${scale})` }}
        >
          <OverlayCanvas overlay={overlay} />
        </div>
      )}
    </div>
  );
};

export default OverlayPreview;
