import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_SCROLLER_HEIGHT,
  DEFAULT_SCROLLER_PAUSE,
  DEFAULT_SCROLLER_SPEED,
  DEFAULT_SCROLLER_WIDTH,
  type PrismaElement,
  type ScrollerStyle,
} from "@/lib/types";
import { CanvasEditingContext, useCanvasEditing } from "./canvasEditing";
import { CanvasInteractionContext } from "./canvasDrag";
import { CanvasSelectionContext } from "./canvasSelection";
import { useElementResize } from "./useElementResize";

const MIN_SCROLLER_SIZE = 20;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface ScrollerProps {
  element: PrismaElement;
  children: React.ReactNode;
}

// The length of the content and of the area it is shown in, along the side it scrolls on.
interface Lengths {
  content: number;
  viewport: number;
}

// The keyframes for one round of scrolling, and how long it takes in milliseconds.
const scrollAnimation = (
  mode: ScrollerStyle["mode"],
  translate: (offset: number) => string,
  { content, viewport }: Lengths,
  gap: number,
  speed: number,
  pause: number
): { keyframes: Keyframe[]; duration: number } => {
  if (mode === "loop") {
    // Moves on by exactly one copy of the content (and the gap after it), where the second copy
    // looks just like the first did at the start, so the round repeats without a jump.
    const distance = content + gap;
    return {
      keyframes: [{ transform: translate(0) }, { transform: translate(-distance) }],
      duration: (distance / speed) * 1000,
    };
  }
  // To the end, wait, back to the start, wait. Eased, so it doesn't jerk at either end.
  const distance = content - viewport;
  const travel = (distance / speed) * 1000;
  const wait = pause * 1000;
  const duration = 2 * wait + 2 * travel;
  return {
    keyframes: [
      { transform: translate(0), offset: 0 },
      { transform: translate(0), offset: wait / duration, easing: "ease-in-out" },
      { transform: translate(-distance), offset: (wait + travel) / duration },
      { transform: translate(-distance), offset: (2 * wait + travel) / duration, easing: "ease-in-out" },
      { transform: translate(0), offset: 1 },
    ],
    duration,
  };
};

// Lays its children out like a container, in a box of at most `width` by `height`. Children
// that don't fit are scrolled through by themselves, back and forth or in an endless loop. While
// elements are being moved on the canvas it holds still at the start, so they can be picked.
const Scroller: React.FC<ScrollerProps> = ({ element, children }) => {
  const editing = useCanvasEditing();
  const style = (element.style || {}) as ScrollerStyle;
  const vertical = style.direction !== "horizontal";
  const mode = style.mode === "loop" ? "loop" : "bounce";
  const fitContent = style.fitContent === true;
  const speed = Math.max(1, toNumber(style.speed, DEFAULT_SCROLLER_SPEED));
  const pause = Math.max(0, toNumber(style.pause, DEFAULT_SCROLLER_PAUSE));
  const gap = Math.max(0, toNumber(style.gap, 0));
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.borderRadius, DEFAULT_BORDER_RADIUS);

  const { dragSize, handle } = useElementResize(element, MIN_SCROLLER_SIZE);
  const width = dragSize?.width ?? toNumber(style.width, DEFAULT_SCROLLER_WIDTH);
  const height = dragSize?.height ?? toNumber(style.height, DEFAULT_SCROLLER_HEIGHT);
  // While resizing, the box takes the size being dragged to, so the handle follows the pointer.
  const shrinks = fitContent && !dragSize;

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lengths, setLengths] = useState<Lengths>({ content: 0, viewport: 0 });

  // Layout sizes (offset*), which the scaled editor canvas leaves alone.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      const next = vertical
        ? { content: content.offsetHeight, viewport: viewport.clientHeight }
        : { content: content.offsetWidth, viewport: viewport.clientWidth };
      setLengths((current) =>
        current.content === next.content && current.viewport === next.viewport ? current : next
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [vertical]);

  const overflows = lengths.content - lengths.viewport >= 1;
  const scrolls = overflows && !editing;
  const looping = scrolls && mode === "loop";

  // How far through a round the last animation was, so a change (a counter getting a digit
  // wider, a new speed) carries on from about the same spot instead of starting over.
  const progress = useRef(0);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !scrolls) {
      progress.current = 0;
      return;
    }
    const translate = (offset: number) =>
      vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`;
    const { keyframes, duration } = scrollAnimation(mode, translate, lengths, gap, speed, pause);
    if (!(duration > 0)) return;
    const animation = track.animate(keyframes, { duration, iterations: Infinity });
    animation.currentTime = progress.current * duration;
    return () => {
      const time = Number(animation.currentTime ?? 0);
      progress.current = (time % duration) / duration;
      animation.cancel();
    };
  }, [scrolls, mode, vertical, lengths, gap, speed, pause]);

  const direction = vertical ? "column" : "row";
  const contentStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: direction,
    gap: `${gap}px`,
    alignItems: style.alignItems || "stretch",
    flexShrink: 0,
    // Across the scrolling side it fills the box; along it, it takes whatever the children need.
    ...(vertical ? { width: "100%" } : { height: "100%" }),
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: direction,
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        width: vertical || !shrinks ? `${width}px` : "fit-content",
        maxWidth: `${width}px`,
        height: !vertical || !shrinks ? `${height}px` : "auto",
        maxHeight: `${height}px`,
        paddingLeft: `${toNumber(style.paddingX, 0)}px`,
        paddingRight: `${toNumber(style.paddingX, 0)}px`,
        paddingTop: `${toNumber(style.paddingY, 0)}px`,
        paddingBottom: `${toNumber(style.paddingY, 0)}px`,
        backgroundColor: style.backgroundColor,
        borderRadius: `${borderRadius}px`,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
            : undefined,
      }}
      className={
        editing ? "outline-1 -outline-offset-1 outline-dashed outline-white/40" : undefined
      }
    >
      {/* Clips inside the padding, so scrolled content doesn't run over it. */}
      <div
        ref={viewportRef}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: direction,
          flex: "1 1 auto",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          ref={trackRef}
          style={{
            display: "flex",
            flexDirection: direction,
            gap: `${gap}px`,
            flexShrink: 0,
            ...(vertical ? { width: "100%" } : { height: "100%", width: "max-content" }),
            willChange: scrolls ? "transform" : undefined,
          }}
        >
          <div ref={contentRef} style={contentStyle}>
            {children}
          </div>
          {looping && (
            // The copy that follows the content round, so the first child comes after the last.
            // It is only a picture: clicks and resize handles belong to the real children.
            <div aria-hidden style={contentStyle}>
              <CanvasEditingContext.Provider value={null}>
                <CanvasSelectionContext.Provider value={null}>
                  <CanvasInteractionContext.Provider value={null}>
                    {children}
                  </CanvasInteractionContext.Provider>
                </CanvasSelectionContext.Provider>
              </CanvasEditingContext.Provider>
            </div>
          )}
        </div>
      </div>
      {handle}
    </div>
  );
};

export default Scroller;
