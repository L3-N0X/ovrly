import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type CounterStyle, type PrismaElement } from "@/lib/types";
import React, { useEffect, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { useSyncedSlider } from "@/lib/hooks/useSyncedSlider";

export const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
  onDelete?: () => void;
  ws: WebSocket | null;
}> = ({ element, onChange, onDelete, ws }) => {
  const [style, setStyle] = useState<CounterStyle>((element.style as CounterStyle) || {});
  const [isPickingColor, setIsPickingColor] = useState(false);

  useEffect(() => {
    if (!isPickingColor) {
      setStyle((element.style as CounterStyle) || {});
    }
  }, [element.style, isPickingColor]);

  const handleStyleChange = (newStyle: Partial<CounterStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const fontSizeSlider = useSyncedSlider(
    `${element.id}-fontSize`,
    (style.fontSize as number) || 128,
    ws,
    { onCommit: (v) => handleStyleChange({ fontSize: v }) }
  );
  const paddingSlider = useSyncedSlider(
    `${element.id}-padding`,
    (style.padding as number) || 0,
    ws,
    { onCommit: (v) => handleStyleChange({ padding: v }) }
  );
  const radiusSlider = useSyncedSlider(`${element.id}-radius`, (style.radius as number) || 0, ws, {
    onCommit: (v) => handleStyleChange({ radius: v }),
  });

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[fontSizeSlider.value]}
            onValueChange={([v]) => fontSizeSlider.onChange(v)}
            onMouseDown={fontSizeSlider.onMouseDown}
            onMouseUp={fontSizeSlider.onMouseUp}
            onTouchStart={fontSizeSlider.onTouchStart}
            onTouchEnd={fontSizeSlider.onTouchEnd}
            max={400}
            min={0}
          />

          <Input
            value={fontSizeSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                fontSizeSlider.onChange(0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                fontSizeSlider.onChange(val);
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
            previewWord="1234567890"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Popover onOpenChange={setIsPickingColor}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.color || "#ffffff" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.color || "#ffffff"}
                onChange={(c) => {
                  handleStyleChange({ color: c });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Background</Label>
          <Popover onOpenChange={setIsPickingColor}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.backgroundColor || "#333333" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.backgroundColor || "#333333"}
                onChange={(c) => {
                  handleStyleChange({ backgroundColor: c });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Padding</Label>
          <div className="flex gap-4">
            <Slider
              value={[paddingSlider.value]}
              onValueChange={([v]) => paddingSlider.onChange(v)}
              onMouseDown={paddingSlider.onMouseDown}
              onMouseUp={paddingSlider.onMouseUp}
              onTouchStart={paddingSlider.onTouchStart}
              onTouchEnd={paddingSlider.onTouchEnd}
              max={300}
              min={0}
            />
            <Input
              value={paddingSlider.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  paddingSlider.onChange(0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  paddingSlider.onChange(val);
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
              value={[radiusSlider.value]}
              onValueChange={([v]) => radiusSlider.onChange(v)}
              onMouseDown={radiusSlider.onMouseDown}
              onMouseUp={radiusSlider.onMouseUp}
              onTouchStart={radiusSlider.onTouchStart}
              onTouchEnd={radiusSlider.onTouchEnd}
              max={100}
            />
            <Input
              value={radiusSlider.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  radiusSlider.onChange(0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  radiusSlider.onChange(val);
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
