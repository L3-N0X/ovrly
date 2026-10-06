import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canvasSize,
  CanvasModeEnum,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  type OnOverlayChange,
  type PrismaOverlay,
} from "@/lib/types";

// Whole pixels only. Sizes outside what OBS can show are clamped rather than rejected, so a
// half-typed value doesn't fight the field it is typed in.
const clampSize = (value: number) =>
  Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value) || MIN_CANVAS_SIZE));

const PixelField = ({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) => {
  // Uncontrolled, so typing isn't rewritten under the cursor. The size follows on blur or
  // Enter, and `key` picks up a size changed from somewhere else (a preset, the other field).
  const commit = (input: HTMLInputElement) => {
    const next = clampSize(parseInt(input.value, 10));
    if (input.value !== String(next)) input.value = String(next);
    if (next !== value) onCommit(next);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        key={value}
        id={id}
        type="number"
        min={MIN_CANVAS_SIZE}
        max={MAX_CANVAS_SIZE}
        defaultValue={value}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
};

// The common canvas sizes, so the usual ones don't have to be typed. Anything else is
// entered by hand, which the free size option stands in for.
const PRESETS = [
  { id: "1920x1080", label: "1080p · 1920 × 1080", width: 1920, height: 1080 },
  { id: "1280x720", label: "720p · 1280 × 720", width: 1280, height: 720 },
  { id: "2560x1440", label: "1440p · 2560 × 1440", width: 2560, height: 1440 },
  { id: "3840x2160", label: "4K · 3840 × 2160", width: 3840, height: 2160 },
  { id: "1080x1920", label: "Vertical · 1080 × 1920", width: 1080, height: 1920 },
  { id: "800x600", label: "Legacy · 800 × 600", width: 800, height: 600 },
  { id: "custom", label: "Custom", width: null, height: null },
];

const presetIdFor = (width: number, height: number) =>
  PRESETS.find((preset) => preset.width === width && preset.height === height)?.id ?? "custom";

// The canvas itself: its size, which OBS is set to, and whether the elements on it are laid
// out by the global arrangement or placed freely. It is the overlay's root group, so it can't
// be removed or nested anywhere.
export const CanvasEditor: React.FC<{
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
}> = ({ overlay, onOverlayChange }) => {
  const { width, height } = canvasSize(overlay);

  const setSize = (patch: { width?: number; height?: number }) =>
    onOverlayChange((current) => ({ ...current, ...patch }));

  const setMode = (canvasMode: PrismaOverlay["canvasMode"]) =>
    onOverlayChange((current) => ({ ...current, canvasMode }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="canvas-preset">Size</Label>
        <Select
          value={presetIdFor(width, height)}
          onValueChange={(presetId) => {
            const preset = PRESETS.find((entry) => entry.id === presetId);
            if (preset?.width && preset.height) {
              setSize({ width: preset.width, height: preset.height });
            }
          }}
        >
          <SelectTrigger id="canvas-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Presets</SelectLabel>
              {PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <PixelField
          id="canvas-width"
          label="Width"
          value={width}
          onCommit={(value) => setSize({ width: value })}
        />
        <PixelField
          id="canvas-height"
          label="Height"
          value={height}
          onCommit={(value) => setSize({ height: value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Set the OBS browser source to {width} × {height} to fill it exactly.
      </p>

      <div className="space-y-2">
        <Label htmlFor="canvas-placement">Placement</Label>
        <Select
          value={overlay.canvasMode}
          onValueChange={(value) => setMode(value as PrismaOverlay["canvasMode"])}
        >
          <SelectTrigger id="canvas-placement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CanvasModeEnum.FREE}>Free placement</SelectItem>
            <SelectItem value={CanvasModeEnum.AUTO}>Auto layout</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {overlay.canvasMode === CanvasModeEnum.FREE ? (
        <p className="text-xs text-muted-foreground">
          Every element on the canvas is placed freely: pick the move tool (M) and drag it, or
          nudge it with the arrow keys. Elements may stick out past the canvas edges. The canvas
          is the group they all live in, so it can't be deleted.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The arrangement below lays out the elements that sit directly on the canvas, in a row
          or a column with gaps. Elements inside a container or a group are unaffected.
        </p>
      )}
    </div>
  );
};

export default CanvasEditor;