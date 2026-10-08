import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";
import { fontFamilyOf, fontWeightOf, loadFont } from "@/lib/fonts";
import { canvasSize, type BaseElementStyle, type PrismaOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";

// A live, scaled down rendering of an overlay. It is only rendered once it scrolls into
// view, so a long list doesn't mount (and tick the timers of) every overlay at once. It is
// read-only unless `interactive` is set (bingo cells can then be clicked, for example).
const OverlayPreview: React.FC<{
  overlay: PrismaOverlay;
  className?: string;
  interactive?: boolean;
}> = ({ overlay, className, interactive = false }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  // Overlays differ in size, so the preview takes the shape of the one it shows.
  const { width, height } = canvasSize(overlay);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => setScale(frame.clientWidth / width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [width]);

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
    overlay.elements.forEach((element) => {
      const style = element.style as BaseElementStyle | null;
      const family = fontFamilyOf(style);
      const weight = fontWeightOf(style);
      loadFont(family, weight).catch((error) =>
        console.error(`Failed to load font: ${family}`, error)
      );
    });
  }, [overlay.elements, isVisible]);

  return (
    <div
      ref={frameRef}
      aria-hidden={!interactive}
      // `inert` keeps bingo cells and the like out of the tab order and away from the pointer.
      inert={!interactive}
      className={cn("relative w-full overflow-hidden bg-neutral-900 select-none", className)}
      style={{
        aspectRatio: `${width} / ${height}`,
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
          style={{ width, height, transform: `scale(${scale})` }}
        >
          <OverlayCanvas overlay={overlay} />
        </div>
      )}
    </div>
  );
};

export default OverlayPreview;
