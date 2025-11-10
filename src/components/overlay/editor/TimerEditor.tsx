import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type PrismaElement, type PrismaOverlay, type TimerStyle } from "@/lib/types";
import { debounce } from "@/lib/utils";
import { Info, Pencil, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { useSyncedSlider } from "@/lib/hooks/useSyncedSlider";
import { RenameElementModal } from "./RenameElementModal";

export const TimerStyleEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  onChange: (newStyle: TimerStyle) => void;
  onDelete?: () => void;
  ws: WebSocket | null;
}> = ({ element, overlay, onOverlayChange, onChange, onDelete, ws }) => {
  const [style, setStyle] = useState<TimerStyle>((element.style as TimerStyle) || {});

  const debouncedOnChange = debounce(onChange, 400);

  const [fgPopoverOpen, setFgPopoverOpen] = useState(false);
  const [bgPopoverOpen, setBgPopoverOpen] = useState(false);

  useEffect(() => {
    if (!fgPopoverOpen && !bgPopoverOpen) {
      setStyle((element.style as TimerStyle) || {});
    }
  }, [element.style, fgPopoverOpen, bgPopoverOpen]);

  const handleStyleChange = (newStyle: Partial<TimerStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    debouncedOnChange(updatedStyle);
  };

  // Synced sliders for responsive UI + websocket broadcasting
  const syncedFontSize = useSyncedSlider(
    `${element.id}.fontSize`,
    typeof style?.fontSize === "number" ? style.fontSize : 128,
    ws
  );
  const syncedPadding = useSyncedSlider(
    `${element.id}.padding`,
    typeof style?.padding === "number" ? style.padding : 0,
    ws,
    { ignoreWindowMs: 300 }
  );
  const syncedRadius = useSyncedSlider(
    `${element.id}.radius`,
    typeof style?.radius === "number" ? style.radius : 0,
    ws,
    { ignoreWindowMs: 300 }
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <div className="flex items-center">
          <RenameElementModal element={element} overlay={overlay} onOverlayChange={onOverlayChange}>
            <Button variant="ghost" size="icon-lg">
              <Pencil />
            </Button>
          </RenameElementModal>
          <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Time Format</Label>
          <Popover>
            <PopoverTrigger>
              <Info className="h-4 w-4 cursor-pointer" />
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-2 p-4 text-sm">
                <p className="font-semibold">Format hint for entering timer display:</p>
                <p>
                  Use special placeholders for your timer: <strong>H</strong> for hours,{" "}
                  <strong>m</strong> for minutes, <strong>s</strong> for seconds.
                </p>
                <p>
                  Example: <strong>H:mm:ss</strong> → 1:05:09
                </p>
                <p>Mix and match as needed for your display:</p>
                <ul className="list-disc list-inside pl-4">
                  <li>
                    <strong>mm:ss</strong> → 07:45 (minutes:seconds)
                  </li>
                  <li>
                    <strong>H:mm</strong> → 3:22 (hours:minutes)
                  </li>
                  <li>
                    <strong>H[h] mm[min] ss[s]</strong> → 2h 01min 15s (text inside brackets will be
                    shown as written)
                  </li>
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          value={style?.format || "HH:mm:ss"}
          onChange={(e) => handleStyleChange({ format: e.target.value })}
          className="h-10 w-full"
        />
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[syncedFontSize.value]}
            onValueChange={(v) => {
              const val = v[0];
              syncedFontSize.onChange(val);
              handleStyleChange({ fontSize: val });
            }}
            onPointerDown={syncedFontSize.onInteractionStart}
            onValueCommit={syncedFontSize.onInteractionEnd}
            max={400}
            min={0}
          />

          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 128}
            onChange={(e) => {
              if (e.target.value === "") {
                handleStyleChange({ fontSize: 0 });
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                // keep UI in sync
                syncedFontSize.onChange(val);
                handleStyleChange({ fontSize: val });
              }
            }}
            onBlur={() => syncedFontSize.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            onChange={(font) => handleStyleChange({ fontFamily: font })}
            previewWord="12:34:56"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Popover open={fgPopoverOpen} onOpenChange={setFgPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.color || "#ffffff" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.color ?? "#ffffff"}
                onChange={(color) => {
                  handleStyleChange({ color: color });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Background</Label>
          <Popover open={bgPopoverOpen} onOpenChange={setBgPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.backgroundColor || "#333333" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.backgroundColor ?? "#ffffff"}
                onChange={(color) => {
                  handleStyleChange({ backgroundColor: color });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Padding</Label>
          <div className="flex gap-4">
            <Slider
              value={[syncedPadding.value]}
              onValueChange={(v) => {
                const val = v[0];
                syncedPadding.onChange(val);
                handleStyleChange({ padding: val });
              }}
              onPointerDown={syncedPadding.onInteractionStart}
              onValueCommit={syncedPadding.onInteractionEnd}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.padding === "number" ? style.padding : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  syncedPadding.onChange(0);
                  handleStyleChange({ padding: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  syncedPadding.onChange(val);
                  handleStyleChange({ padding: val });
                }
              }}
              onBlur={() => syncedPadding.onInteractionEnd()}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Corner Radius</Label>
          <div className="flex gap-4">
            <Slider
              value={[syncedRadius.value]}
              onValueChange={(v) => {
                const val = v[0];
                syncedRadius.onChange(val);
                handleStyleChange({ radius: val });
              }}
              onPointerDown={syncedRadius.onInteractionStart}
              onValueCommit={syncedRadius.onInteractionEnd}
              max={100}
            />
            <Input
              value={typeof style?.radius === "number" ? style.radius : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  syncedRadius.onChange(0);
                  handleStyleChange({ radius: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  syncedRadius.onChange(val);
                  handleStyleChange({ radius: val });
                }
              }}
              onBlur={() => syncedRadius.onInteractionEnd()}
              className="h-10 w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
