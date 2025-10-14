import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type TimerStyle, type PrismaElement } from "@/lib/types";
import React from "react";
import { ColorPicker, useColor } from "react-color-palette";
import { FontPicker } from "../../FontPicker";
import { handleValueChange } from "./helper";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TimerStyleEditor: React.FC<{ 
  element: PrismaElement;
  onChange: (newStyle: TimerStyle) => void;
  onDelete?: () => void;
}> = ({ element, onChange, onDelete }) => {
  const [color, setColor] = useColor((element.style as TimerStyle)?.color || "#ffffff");
  const [bgColor, setBgColor] = useColor(
    (element.style as TimerStyle)?.backgroundColor || "#333333"
  );

  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as TimerStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Time Format</Label>
        <Input
          value={style?.format || "HH:mm:ss"}
          onChange={(e) => updateStyle("format", e.target.value)}
          className="h-10 w-full"
        />
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[typeof style?.fontSize === "number" ? style.fontSize : 128]}
            onValueChange={(v) => updateStyle("fontSize", v[0])}
            max={400}
            min={0}
          />

          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 128}
            onChange={(e) => {
              if (e.target.value === "") {
                updateStyle("fontSize", 0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                updateStyle("fontSize", val);
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
            onChange={(font) => updateStyle("fontFamily", font)}
            previewWord="12:34:56"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: color.hex }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPicker
                color={color}
                onChange={(c) => {
                  setColor(c);
                  updateStyle("color", c.hex);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Background</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: bgColor.hex }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPicker
                color={bgColor}
                onChange={(c) => {
                  setBgColor(c);
                  updateStyle("backgroundColor", c.hex);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Padding</Label>
          <div className="flex gap-4">
            <Slider
              value={[
                (() => {
                  const padding = (element.style as TimerStyle)?.padding;
                  return padding !== undefined && padding !== null ? padding : 0;
                })(),
              ]}
              onValueChange={(v) => updateStyle("padding", v[0])}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.padding === "number" ? style.padding : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("padding", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("padding", val);
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
              value={[
                (() => {
                  const radius = (element.style as TimerStyle)?.radius;
                  return radius !== undefined && radius !== null ? radius : 0;
                })(),
              ]}
              onValueChange={(v) => updateStyle("radius", v[0])}
              max={100}
            />
            <Input
              value={typeof style?.radius === "number" ? style.radius : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("radius", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("radius", val);
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
