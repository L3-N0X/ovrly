import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minus, MousePointer2, Move, Plus } from "lucide-react";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";
import type { CanvasEditing } from "@/components/overlay/canvasEditing";
import type { CanvasSelection } from "@/components/overlay/canvasSelection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ElementTypeEnum,
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  type ElementStyle,
  type OnOverlayChange,
  type PrismaOverlay,
} from "@/lib/types";
import { OVERLAY_SELECTION, type EditorSelection } from "./editorSelection";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const ZOOM_PRESETS = [0.5, 1, 2];
// How far a press has to travel before it pans instead of clicking what's under it.
const DRAG_THRESHOLD = 4;
// Large enough to shade everything outside the overlay at any zoom (in screen pixels).
const SHADE_SIZE = 20000;

type Tool = "select" | "move";

// The canvas is drawn at `zoom` with its top left corner at (x, y) in the viewport.
interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  panning: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

interface EditorCanvasProps {
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  selectedId: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}

// An endless canvas around the overlay that can be panned and zoomed. Elements outside the
// overlay stay visible (shaded), so things placed off screen can still be found and picked.
const EditorCanvas: React.FC<EditorCanvasProps> = ({
  overlay,
  onOverlayChange,
  selectedId,
  onSelect,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  // Until the user pans or zooms, the overlay is kept fitted to the available space.
  const autoFit = useRef(true);
  const gesture = useRef<PanGesture | null>(null);
  // A pan ends with a click on whatever is under the pointer, which must not select it.
  const suppressClick = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());

  const fitToScreen = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    const { clientWidth: width, clientHeight: height } = el;
    const padding = Math.min(56, width / 12);
    const zoom = clamp(
      Math.min((width - padding * 2) / OVERLAY_WIDTH, (height - padding * 2) / OVERLAY_HEIGHT),
      MIN_ZOOM,
      MAX_ZOOM
    );
    autoFit.current = true;
    setViewport({
      zoom,
      x: (width - OVERLAY_WIDTH * zoom) / 2,
      y: (height - OVERLAY_HEIGHT * zoom) / 2,
    });
  }, []);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    fitToScreen();
    const observer = new ResizeObserver(() => {
      if (autoFit.current) fitToScreen();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitToScreen]);

  // Keeps the canvas point under (px, py), in viewport pixels, where it is.
  const zoomAt = useCallback((px: number, py: number, getZoom: (zoom: number) => number) => {
    autoFit.current = false;
    setViewport((current) => {
      const zoom = clamp(getZoom(current.zoom), MIN_ZOOM, MAX_ZOOM);
      const ratio = zoom / current.zoom;
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  const zoomAtCenter = useCallback(
    (getZoom: (zoom: number) => number) => {
      const el = viewportRef.current;
      if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, getZoom);
    },
    [zoomAt]
  );

  const panBy = useCallback((dx: number, dy: number) => {
    autoFit.current = false;
    setViewport((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, []);

  // Scrolling pans and Ctrl/Cmd + scroll (or a trackpad pinch) zooms, like in Figma.
  // Registered natively: React's wheel listener is passive, so it can't keep the page from
  // scrolling or the browser from zooming.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? el.clientHeight
            : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        // Pinches send many small deltas, mouse wheel notches a few large ones; capping them
        // keeps a single notch from jumping too far.
        const factor = Math.exp(-clamp(dy, -50, 50) * 0.006);
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, (zoom) => zoom * factor);
      } else if (e.shiftKey && dx === 0) {
        panBy(-dy, 0);
      } else {
        panBy(-dx, -dy);
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoomAt, panBy]);

  useEffect(() => {
    // Shortcuts only apply while nothing else wants the keys: not while typing, and not
    // inside dialogs or menus.
    const isFree = (e: KeyboardEvent) =>
      !e.defaultPrevented &&
      !isEditableTarget(e.target) &&
      !(
        e.target instanceof Element &&
        e.target.closest('[role="dialog"], [role="menu"], [role="listbox"]')
      );
    // Space and Escape mean something else on buttons and tree rows, so they are only taken
    // when the canvas (or nothing in particular) has focus.
    const isCanvasFocused = (e: KeyboardEvent) =>
      e.target === document.body ||
      (e.target instanceof Node && !!viewportRef.current?.contains(e.target));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFree(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " " || e.key === "Escape") {
        if (!isCanvasFocused(e)) return;
        e.preventDefault();
        if (e.key === "Escape") onSelect(null);
        else if (!e.repeat) {
          spaceHeldRef.current = true;
          setSpaceHeld(true);
        }
        return;
      }
      if (e.shiftKey && e.code === "Digit1") fitToScreen();
      else if (e.shiftKey && e.code === "Digit0") zoomAtCenter(() => 1);
      else if (e.key === "+" || e.key === "=") zoomAtCenter((zoom) => zoom * ZOOM_STEP);
      else if (e.key === "-") zoomAtCenter((zoom) => zoom / ZOOM_STEP);
      else if (e.key.toLowerCase() === "v") setTool("select");
      else if (e.key.toLowerCase() === "m") setTool("move");
      else return;
      e.preventDefault();
    };
    const releaseSpace = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") releaseSpace();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseSpace);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseSpace);
    };
  }, [fitToScreen, zoomAtCenter, onSelect]);

  const startPanning = (pointerId: number) => {
    if (!gesture.current) return;
    gesture.current.panning = true;
    // Captured only now: capturing on press would send the click to the canvas instead of
    // the element that was pressed.
    viewportRef.current?.setPointerCapture(pointerId);
    setIsPanning(true);
  };

  const beginGesture = (e: React.PointerEvent) => {
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      panning: false,
    };
  };

  const cancelGesture = () => {
    if (gesture.current?.panning) {
      suppressClick.current = true;
      setIsPanning(false);
    }
    gesture.current = null;
  };

  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // A second finger turns the gesture into a pinch.
      if (touches.current.size === 2) cancelGesture();
      if (touches.current.size > 1) return;
    }
    // The middle button and space + drag pan from anywhere, before elements get the press.
    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
      e.preventDefault();
      e.stopPropagation();
      beginGesture(e);
      startPanning(e.pointerId);
    }
  };

  // Only reached when no element claimed the press (movable elements do in the move tool).
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gesture.current || touches.current.size > 1) return;
    if (isEditableTarget(e.target)) return;
    beginGesture(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const previous = touches.current.get(e.pointerId);
    if (previous) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.entries()].map(([id, point]) =>
          id === e.pointerId ? [previous, point] : [point, point]
        );
        const before = { x: (a[0].x + b[0].x) / 2, y: (a[0].y + b[0].y) / 2 };
        const after = { x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 };
        const distanceBefore = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y);
        const distanceAfter = Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y);
        const rect = e.currentTarget.getBoundingClientRect();
        if (distanceBefore > 0) {
          zoomAt(after.x - rect.left, after.y - rect.top, (z) => (z * distanceAfter) / distanceBefore);
        }
        panBy(after.x - before.x, after.y - before.y);
        return;
      }
    }

    const current = gesture.current;
    if (!current || current.pointerId !== e.pointerId) return;
    if (!current.panning) {
      const distance = Math.hypot(e.clientX - current.startX, e.clientY - current.startY);
      if (distance < DRAG_THRESHOLD) return;
      startPanning(e.pointerId);
    }
    panBy(e.clientX - current.lastX, e.clientY - current.lastY);
    current.lastX = e.clientX;
    current.lastY = e.clientY;
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    touches.current.delete(e.pointerId);
    if (gesture.current?.pointerId === e.pointerId) cancelGesture();
  };

  const editing = useMemo<CanvasEditing | null>(() => {
    if (tool !== "move") return null;
    // onOverlayChange persists the style change itself (debounced per element).
    const patchStyle = (elementId: string, patch: ElementStyle) =>
      onOverlayChange((current) => ({
        ...current,
        elements: current.elements.map((el) =>
          el.id === elementId ? { ...el, style: { ...(el.style || {}), ...patch } } : el
        ),
      }));
    return { onMove: patchStyle, onResize: patchStyle };
  }, [tool, onOverlayChange]);

  const selection = useMemo<CanvasSelection>(
    () => ({ selectedId, onSelect }),
    [selectedId, onSelect]
  );

  // The same element every time the viewport changes, so panning and zooming don't
  // re-render the overlay.
  const canvas = useMemo(
    () => <OverlayCanvas overlay={overlay} editing={editing} selection={selection} clip={false} />,
    [overlay, editing, selection]
  );

  const { x, y, zoom } = viewport;
  const shade = SHADE_SIZE / zoom;
  const frameSelected = selectedId === OVERLAY_SELECTION;
  const hasGroups = overlay.elements.some((e) => e.type === ElementTypeEnum.GROUP);
  const grabbing = isPanning || spaceHeld;

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-200 select-none dark:bg-neutral-950">
      <div
        ref={viewportRef}
        className={cn(
          "absolute inset-0 touch-none",
          // Elements set their own cursors, which would hide that the canvas is being dragged.
          grabbing && "**:cursor-[inherit]!"
        )}
        style={{
          cursor: isPanning ? "grabbing" : spaceHeld ? "grab" : undefined,
          backgroundImage: "radial-gradient(circle, rgb(128 128 128 / 0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: `${x}px ${y}px`,
        }}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        // Keeps the middle button from starting the browser's autoscroll.
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Clicks on the overlay are handled by the overlay; this is the space around it.
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={
            {
              transform: `translate(${x}px, ${y}px) scale(${zoom})`,
              "--canvas-zoom": zoom,
            } as React.CSSProperties
          }
        >
          <div className="relative bg-black" style={{ width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT }}>
            {canvas}
          </div>
          {/* Shades everything outside the overlay: it exists, but OBS won't show it. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]">
            {[
              { left: -shade, top: -shade, width: OVERLAY_WIDTH + shade * 2, height: shade },
              { left: -shade, top: OVERLAY_HEIGHT, width: OVERLAY_WIDTH + shade * 2, height: shade },
              { left: -shade, top: 0, width: shade, height: OVERLAY_HEIGHT },
              { left: OVERLAY_WIDTH, top: 0, width: shade, height: OVERLAY_HEIGHT },
            ].map((rect, i) => (
              <div
                key={i}
                className="absolute bg-neutral-200/75 dark:bg-neutral-950/75"
                style={rect}
              />
            ))}
          </div>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 left-0 z-[6] outline-solid",
              frameSelected ? "outline-sky-400" : "outline-neutral-400/60 dark:outline-neutral-600"
            )}
            style={{
              width: OVERLAY_WIDTH,
              height: OVERLAY_HEIGHT,
              outlineWidth: `calc(${frameSelected ? 2 : 1}px / var(--canvas-zoom))`,
            }}
          />
        </div>

        {/* The overlay's name above its top left corner, like a frame title in Figma. */}
        <button
          type="button"
          className={cn(
            "absolute flex max-w-full items-baseline gap-2 truncate pb-1 text-xs",
            frameSelected ? "text-sky-500" : "text-muted-foreground hover:text-foreground"
          )}
          style={{
            left: x,
            top: y,
            maxWidth: Math.max(OVERLAY_WIDTH * zoom, 120),
            transform: "translateY(-100%)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onSelect(OVERLAY_SELECTION)}
        >
          <span className="truncate font-medium">{overlay.name}</span>
          <span className="shrink-0 tabular-nums opacity-70">
            {OVERLAY_WIDTH} × {OVERLAY_HEIGHT}
          </span>
        </button>
      </div>

      <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-md backdrop-blur">
        <ToolButton
          active={tool === "select"}
          onClick={() => setTool("select")}
          label="Select"
          shortcut="V"
        >
          <MousePointer2 />
        </ToolButton>
        <ToolButton
          active={tool === "move"}
          onClick={() => setTool("move")}
          label="Move elements in groups"
          shortcut="M"
        >
          <Move />
        </ToolButton>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[calc(100%-16rem)] text-xs text-muted-foreground sm:block">
        {tool === "select"
          ? "Click to select · Drag or scroll to pan · Ctrl + scroll to zoom"
          : hasGroups
            ? "Drag elements inside a group to place them · Arrow keys nudge (Shift: 10px) · Drag a group's corner to resize"
            : "Add a Group element to place elements freely, then drag them here."}
      </p>

      <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-md backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom out (-)"
          onClick={() => zoomAtCenter((z) => z / ZOOM_STEP)}
        >
          <Minus />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-16 tabular-nums">
              {Math.round(zoom * 100)}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuItem onClick={fitToScreen}>
              <Maximize />
              Zoom to fit
              <DropdownMenuShortcut>Shift+1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset} onClick={() => zoomAtCenter(() => preset)}>
                Zoom to {preset * 100}%
                {preset === 1 && <DropdownMenuShortcut>Shift+0</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom in (+)"
          onClick={() => zoomAtCenter((z) => z * ZOOM_STEP)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
};

const ToolButton = ({
  active,
  onClick,
  label,
  shortcut,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut: string;
  children: React.ReactNode;
}) => (
  <Button
    variant={active ? "default" : "ghost"}
    size="icon-sm"
    title={`${label} (${shortcut})`}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
  >
    {children}
  </Button>
);

export default EditorCanvas;
