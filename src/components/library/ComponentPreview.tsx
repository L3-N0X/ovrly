import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ElementDisplay from "@/components/overlay/ElementDisplay";
import { resolveOverlay } from "@/lib/bindings";
import { fontFamilyOf, fontWeightOf, loadFont } from "@/lib/fonts";
import { seedsToElements } from "@/lib/presets";
import type { OverlayComponent } from "@/lib/components";
import type { BaseElementStyle, OverlayVariable, PrismaOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";

// How much of the frame the component may fill, and how far a small one is blown up.
const FILL = 0.88;
const MAX_SCALE = 2;

// A live rendering of a component, scaled to fit the frame (which sets the size). Like overlay
// previews it is only rendered once it scrolls into view, and it is read only. With `variables`
// (the ones of the overlay it is about to be added to), bound properties show their values.
const ComponentPreview: React.FC<{
  component: OverlayComponent;
  variables?: OverlayVariable[];
  className?: string;
}> = ({ component, variables, className }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [scale, setScale] = useState(0);

  const elements = useMemo(() => {
    const overlay = {
      elements: seedsToElements(component.elements, component.id),
      variables,
    } as PrismaOverlay;
    return resolveOverlay(overlay).elements;
  }, [component, variables]);
  const roots = elements.filter((element) => !element.parentId);

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

  // Re-measured whenever either side changes size: fonts load late, images arrive later still.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const measure = () => {
      // Layout sizes, which the scale transform doesn't change.
      const width = content.offsetWidth;
      const height = content.offsetHeight;
      if (!width || !height) return;
      setScale(
        Math.min(
          MAX_SCALE,
          (frame.clientWidth * FILL) / width,
          (frame.clientHeight * FILL) / height
        )
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    elements.forEach((element) => {
      const style = element.style as BaseElementStyle | null;
      const family = fontFamilyOf(style);
      loadFont(family, fontWeightOf(style)).catch((error) =>
        console.error(`Failed to load font: ${family}`, error)
      );
    });
  }, [elements, isVisible]);

  return (
    <div
      ref={frameRef}
      aria-hidden
      inert
      className={cn("relative overflow-hidden bg-neutral-900 select-none", className)}
      style={{
        // Transparent parts are shown as a checkerboard, like in overlay previews.
        backgroundImage:
          "linear-gradient(45deg, rgb(255 255 255 / 0.04) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.04) 75%), linear-gradient(45deg, rgb(255 255 255 / 0.04) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.04) 75%)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 12px 12px",
      }}
    >
      {isVisible && (
        <div
          ref={contentRef}
          // Measured at its own size, then scaled around the frame's centre.
          className="absolute top-1/2 left-1/2 flex w-max flex-col items-center gap-4"
          style={{
            transform: `translate(-50%, -50%) scale(${scale})`,
            visibility: scale > 0 ? "visible" : "hidden",
          }}
        >
          {roots.map((element) => (
            <ElementDisplay key={element.id} element={element} elements={elements} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ComponentPreview;
