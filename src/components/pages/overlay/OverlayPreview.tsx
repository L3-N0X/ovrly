import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Move } from "lucide-react";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";
import type { CanvasEditing } from "@/components/overlay/canvasEditing";
import { Button } from "@/components/ui/button";
import { ElementTypeEnum, type ElementStyle, type PrismaOverlay } from "@/lib/types";

interface OverlayPreviewProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

const OverlayPreview: React.FC<OverlayPreviewProps> = ({ overlay, onOverlayChange }) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [moveMode, setMoveMode] = useState(false);
  const hasGroups = overlay.elements.some((e) => e.type === ElementTypeEnum.GROUP);

  const calculateScale = useCallback(() => {
    if (previewContainerRef.current) {
      const { width } = previewContainerRef.current.getBoundingClientRect();
      setScale(width / 800);
    }
  }, []);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale, overlay]);

  // onOverlayChange persists the style change itself (debounced per element).
  const editing = useMemo<CanvasEditing | null>(() => {
    if (!moveMode) return null;
    const patchStyle = (elementId: string, patch: ElementStyle) =>
      onOverlayChange({
        ...overlay,
        elements: overlay.elements.map((el) =>
          el.id === elementId ? { ...el, style: { ...(el.style || {}), ...patch } } : el
        ),
      });
    return { onMove: patchStyle, onResize: patchStyle };
  }, [moveMode, overlay, onOverlayChange]);

  return (
    <div
      ref={previewContainerRef}
      className="flex flex-col items-center border rounded-lg bg-secondary pt-4 md:sticky top-20"
    >
      <div className="flex items-center justify-between w-full px-4 mb-2">
        <h2 className="text-xl font-semibold">Preview</h2>
        <Button
          variant={moveMode ? "default" : "outline"}
          size="sm"
          onClick={() => setMoveMode(!moveMode)}
          aria-pressed={moveMode}
        >
          <Move />
          {moveMode ? "Done moving" : "Move elements"}
        </Button>
      </div>
      <div className="aspect-[4/3] w-full max-w-full overflow-hidden flex justify-center items-center bg-black dark:bg-black">
        <div
          style={{
            width: "800px",
            height: "600px",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <OverlayCanvas overlay={overlay} editing={editing} />
        </div>
      </div>
      <div className="py-2 px-4 text-sm text-muted-foreground mb-4 text-center">
        {!moveMode
          ? "Live Preview (800x600)"
          : hasGroups
            ? "Drag elements inside a group to place them. Arrow keys nudge, hold Shift for 10px steps. Drag the corner handle to resize a group."
            : "Add a Group element to place elements freely, then drag them here."}
      </div>
    </div>
  );
};

export default OverlayPreview;
