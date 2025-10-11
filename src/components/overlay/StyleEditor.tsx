import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ColorPicker, useColor } from "react-color-palette";
import type { OverlayStyle } from "./DisplayCounter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StyleEditorProps {
  style: OverlayStyle;
  onStyleChange: (newStyle: OverlayStyle) => void;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ style, onStyleChange }) => {
  const [titleColor, setTitleColor] = useColor(style.title?.color || "#ffffff");
  const [counterColor, setCounterColor] = useColor(style.counter?.color || "#ffffff");

  const handleValueChange = (path: string, value: string | number) => {
    const keys = path.split(".");
    const newStyle = JSON.parse(JSON.stringify(style));
    let current = newStyle;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    onStyleChange(newStyle);
  };

  const handleSliderChange = (path: string, value: number[]) => {
    handleValueChange(path, value[0]);
  };

  const handleNumericInputChange = (path: string, value: string) => {
    if (/^\d*$/.test(value)) {
      const numValue = value === "" ? 0 : parseInt(value, 10);
      handleValueChange(path, numValue);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the look and feel of your overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Arrangement</Label>
            <Select
              value={style.arrangement || "column"}
              onValueChange={(value) => handleValueChange("arrangement", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select arrangement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="column">Text Above</SelectItem>
                <SelectItem value="column-reverse">Text Below</SelectItem>
                <SelectItem value="row">Text Left</SelectItem>
                <SelectItem value="row-reverse">Text Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Distance (px)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[parseInt(String(style.distance || 16))]}
                onValueChange={(value) => handleSliderChange("distance", value)}
                max={200}
                step={1}
              />
              <Input
                type="text"
                value={style.distance || ""}
                onChange={(e) => handleNumericInputChange("distance", e.target.value)}
                className="w-20"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Title</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Font Size (px)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[parseInt(String(style.title?.fontSize || 36))]}
                  onValueChange={(value) => handleSliderChange("title.fontSize", value)}
                  max={200}
                  step={1}
                />
                <Input
                  type="text"
                  value={style.title?.fontSize || ""}
                  onChange={(e) => handleNumericInputChange("title.fontSize", e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={style.title?.fontFamily || ""}
                onChange={(e) => handleValueChange("title.fontFamily", e.target.value)}
                placeholder="e.g., 'Roboto', sans-serif"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-full h-10 rounded-md border border-input"
                    style={{ backgroundColor: titleColor.hex }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <ColorPicker
                    color={titleColor}
                    onChange={(color) => {
                      setTitleColor(color);
                      handleValueChange("title.color", color.hex);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Number</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Font Size (px)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[parseInt(String(style.counter?.fontSize || 128))]}
                  onValueChange={(value) => handleSliderChange("counter.fontSize", value)}
                  max={400}
                  step={1}
                />
                <Input
                  type="text"
                  value={style.counter?.fontSize || ""}
                  onChange={(e) => handleNumericInputChange("counter.fontSize", e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={style.counter?.fontFamily || ""}
                onChange={(e) => handleValueChange("counter.fontFamily", e.target.value)}
                placeholder="e.g., 'Roboto', sans-serif"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-full h-10 rounded-md border border-input"
                    style={{ backgroundColor: counterColor.hex }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <ColorPicker
                    color={counterColor}
                    onChange={(color) => {
                      setCounterColor(color);
                      handleValueChange("counter.color", color.hex);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
