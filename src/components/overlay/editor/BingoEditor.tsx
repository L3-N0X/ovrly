import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { type BingoStyle, type PrismaElement, type PrismaOverlay } from "@/lib/types";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { RenameElementModal } from "./RenameElementModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSyncedSlider } from "@/lib/hooks/useSyncedSlider";
import {
  BINGO_BORDER_RADIUS_RANGE,
  BINGO_BORDER_WIDTH_RANGE,
  BINGO_CROSS_WIDTH_RANGE,
  BINGO_FONT_SIZE_RANGE,
  BINGO_GAP_RANGE,
  BINGO_MAX_FIELD_LENGTH,
  BINGO_PADDING_RANGE,
  BINGO_SIZE_RANGE,
  bingoSizes,
  DEFAULT_BINGO_SIZE,
  resolveBingoStyle,
  type BingoDataUpdate,
} from "@/lib/bingo";

/**
 * Slider plus numeric input, mirrored across clients over the editor
 * WebSocket so dragging also updates the OBS preview.
 */
const NumberControl: React.FC<{
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  ws: WebSocket | null;
  onChange: (value: number) => void;
}> = ({ id, label, min, max, value, ws, onChange }) => {
  const slider = useSyncedSlider(id, value, ws);

  useEffect(() => {
    if (slider.value !== value) {
      onChange(slider.value);
    }
  }, [slider.value, value, onChange]);

  const clamp = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return null;
    return Math.min(max, Math.max(min, parsed));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-4">
        <Slider
          id={id}
          value={[slider.value]}
          onValueChange={([next]) => slider.onChange(next)}
          onPointerDown={slider.onInteractionStart}
          onValueCommit={slider.onInteractionEnd}
          min={min}
          max={max}
          step={1}
        />
        <Input
          aria-label={`${label} value`}
          value={slider.value}
          onChange={(event) => {
            const next = clamp(event.target.value);
            if (next !== null) {
              slider.onChange(next);
            }
          }}
          onBlur={() => slider.onInteractionEnd()}
          className="h-10 w-20 shrink-0"
        />
      </div>
    </div>
  );
};

const ColorControl: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
  onOpenChange: (open: boolean) => void;
}> = ({ id, label, value, onChange, onOpenChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={label}
          className="h-10 w-full rounded-md border"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <ColorPickerEditor value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  </div>
);

export const BingoEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  onChange: (newStyle: BingoStyle) => void;
  onDataChange?: (elementId: string, data: BingoDataUpdate) => void;
  onDelete?: () => void;
  ws: WebSocket | null;
}> = ({ element, overlay, onOverlayChange, onChange, onDataChange, onDelete, ws }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Optimistic value for the free-middle switch, cleared once the server state
  // for this element comes back through.
  const [pendingFreeMiddle, setPendingFreeMiddle] = useState<boolean | null>(null);

  const bingoStyle = useMemo(
    () => resolveBingoStyle(element.style as BingoStyle | null),
    [element.style]
  );
  const [style, setStyle] = useState<BingoStyle>(bingoStyle);

  // Resync from the server, but never while a colour picker is open: that would
  // snap the swatch back mid-interaction.
  useEffect(() => {
    if (!isPickingColor) {
      setStyle(bingoStyle);
    }
  }, [bingoStyle, isPickingColor]);

  useEffect(() => {
    setPendingFreeMiddle(null);
  }, [element.bingo]);

  const handleStyleChange = useCallback(
    (newStylePart: Partial<BingoStyle>) => {
      setStyle((current) => {
        const updated = { ...current, ...newStylePart };
        onChange(updated);
        return updated;
      });
    },
    [onChange]
  );

  const size = element.bingo?.size ?? DEFAULT_BINGO_SIZE;
  const freeMiddle = element.bingo?.freeMiddle ?? false;
  const canUseFreeMiddle = size % 2 === 1;

  const handleSizeChange = (value: string) => {
    const nextSize = Number.parseInt(value, 10);
    if (!Number.isInteger(nextSize) || nextSize === size) return;
    onDataChange?.(element.id, { size: nextSize });
  };

  const handleFreeMiddleChange = (checked: boolean) => {
    if (!onDataChange || !canUseFreeMiddle) return;
    setPendingFreeMiddle(checked);
    onDataChange(element.id, { freeMiddle: checked });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <div className="flex items-center">
          <RenameElementModal element={element} overlay={overlay} onOverlayChange={onOverlayChange}>
            <Button variant="ghost" size="icon-lg" aria-label="Rename element">
              <Pencil />
            </Button>
          </RenameElementModal>
          {onDelete && (
            <Button
              variant="destructiveGhost"
              size="icon-lg"
              onClick={onDelete}
              aria-label="Delete element"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Bingo Settings</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${element.id}-size`}>Card Size</Label>
            <Select value={String(size)} onValueChange={handleSizeChange}>
              <SelectTrigger id={`${element.id}-size`}>
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {bingoSizes.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}x{option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-2 space-x-2">
            <Switch
              id={`${element.id}-free-middle`}
              checked={pendingFreeMiddle ?? freeMiddle}
              onCheckedChange={handleFreeMiddleChange}
              disabled={!canUseFreeMiddle || !onDataChange}
            />
            <Label htmlFor={`${element.id}-free-middle`}>
              Free Middle
              {!canUseFreeMiddle && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (needs an odd size)
                </span>
              )}
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Changing the size keeps the labels that still fit and clears the rest. Names are edited in
          Data Controls.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <NumberControl
          id={`${element.id}-bingo-width`}
          label="Width"
          min={BINGO_SIZE_RANGE.min}
          max={BINGO_SIZE_RANGE.max}
          value={style.width ?? 320}
          ws={ws}
          onChange={(width) => handleStyleChange({ width })}
        />
        <NumberControl
          id={`${element.id}-bingo-height`}
          label="Height"
          min={BINGO_SIZE_RANGE.min}
          max={BINGO_SIZE_RANGE.max}
          value={style.height ?? 320}
          ws={ws}
          onChange={(height) => handleStyleChange({ height })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${element.id}-bingo-font-family`}>Font Family</Label>
        <FontPicker
          value={style.fontFamily || ""}
          onChange={(fontFamily) => handleStyleChange({ fontFamily })}
        />
      </div>

      <NumberControl
        id={`${element.id}-bingo-font-size`}
        label="Max Font Size"
        min={BINGO_FONT_SIZE_RANGE.min}
        max={BINGO_FONT_SIZE_RANGE.max}
        value={style.fontSize ?? 16}
        ws={ws}
        onChange={(fontSize) => handleStyleChange({ fontSize })}
      />
      <p className="text-xs text-muted-foreground">
        Labels shrink automatically to fit their cell, never exceeding this size.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <ColorControl
          id={`${element.id}-bingo-color`}
          label="Color"
          value={style.color ?? "#ffffff"}
          onChange={(color) => handleStyleChange({ color })}
          onOpenChange={setIsPickingColor}
        />
        <ColorControl
          id={`${element.id}-bingo-background`}
          label="Background Color"
          value={style.backgroundColor ?? "#121212"}
          onChange={(backgroundColor) => handleStyleChange({ backgroundColor })}
          onOpenChange={setIsPickingColor}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorControl
          id={`${element.id}-bingo-border-color`}
          label="Border Color"
          value={style.borderColor ?? "#ffffff"}
          onChange={(borderColor) => handleStyleChange({ borderColor })}
          onOpenChange={setIsPickingColor}
        />
        <ColorControl
          id={`${element.id}-bingo-checked-background`}
          label="Checked Background"
          value={style.checkedBackgroundColor ?? "#A47C3A"}
          onChange={(checkedBackgroundColor) => handleStyleChange({ checkedBackgroundColor })}
          onOpenChange={setIsPickingColor}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorControl
          id={`${element.id}-bingo-checked-color`}
          label="Checked Color"
          value={style.checkedColor ?? "#E7B363"}
          onChange={(checkedColor) => handleStyleChange({ checkedColor })}
          onOpenChange={setIsPickingColor}
        />
        <ColorControl
          id={`${element.id}-bingo-cross-color`}
          label="Cross Color"
          value={style.checkedCrossColor ?? "#ffffff"}
          onChange={(checkedCrossColor) => handleStyleChange({ checkedCrossColor })}
          onOpenChange={setIsPickingColor}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberControl
          id={`${element.id}-bingo-gap`}
          label="Gap"
          min={BINGO_GAP_RANGE.min}
          max={BINGO_GAP_RANGE.max}
          value={style.gap ?? 4}
          ws={ws}
          onChange={(gap) => handleStyleChange({ gap })}
        />
        <NumberControl
          id={`${element.id}-bingo-padding`}
          label="Padding"
          min={BINGO_PADDING_RANGE.min}
          max={BINGO_PADDING_RANGE.max}
          value={style.padding ?? 4}
          ws={ws}
          onChange={(padding) => handleStyleChange({ padding })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <NumberControl
          id={`${element.id}-bingo-border-width`}
          label="Border Width"
          min={BINGO_BORDER_WIDTH_RANGE.min}
          max={BINGO_BORDER_WIDTH_RANGE.max}
          value={style.borderWidth ?? 1}
          ws={ws}
          onChange={(borderWidth) => handleStyleChange({ borderWidth })}
        />
        <NumberControl
          id={`${element.id}-bingo-border-radius`}
          label="Border Radius"
          min={BINGO_BORDER_RADIUS_RANGE.min}
          max={BINGO_BORDER_RADIUS_RANGE.max}
          value={style.borderRadius ?? 8}
          ws={ws}
          onChange={(borderRadius) => handleStyleChange({ borderRadius })}
        />
      </div>
      <NumberControl
        id={`${element.id}-bingo-cross-width`}
        label="Cross Width"
        min={BINGO_CROSS_WIDTH_RANGE.min}
        max={BINGO_CROSS_WIDTH_RANGE.max}
        value={style.crossWidth ?? 4}
        ws={ws}
        onChange={(crossWidth) => handleStyleChange({ crossWidth })}
      />

      <p className="text-xs text-muted-foreground">
        Card labels are limited to {BINGO_MAX_FIELD_LENGTH} characters.
      </p>
    </div>
  );
};
