import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type PrismaElement, type TimerStyle } from "@/lib/types";
import { debounce } from "@/lib/utils";
import { Info, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { ColorPickerEditor } from "./ColorPickerEditor";

export const TimerStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TimerStyle) => void;
  onDelete?: () => void;
  ws: WebSocket | null;
}> = ({ element, onChange, onDelete, ws }) => {
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

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
          <Trash2 />
        </Button>
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
            value={[typeof style?.fontSize === "number" ? style.fontSize : 128]}
            onValueChange={(v) => handleStyleChange({ fontSize: v[0] })}
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
                handleStyleChange({ fontSize: val });
              }
            }}
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
              value={[typeof style?.padding === "number" ? style.padding : 0]}
              onValueChange={(v) => handleStyleChange({ padding: v[0] })}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.padding === "number" ? style.padding : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  handleStyleChange({ padding: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleStyleChange({ padding: val });
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Corner Radius</Label>
          <div className="flex gap-4">
            <Slider
              value={[typeof style?.radius === "number" ? style.radius : 0]}
              onValueChange={(v) => handleStyleChange({ radius: v[0] })}
              max={100}
            />
            <Input
              value={typeof style?.radius === "number" ? style.radius : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  handleStyleChange({ radius: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleStyleChange({ radius: val });
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
