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
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalDistributeEnd,
  AlignHorizontalDistributeStart,
  AlignVerticalDistributeCenter,
  AlignVerticalDistributeEnd,
  AlignVerticalDistributeStart,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FontPicker } from "../FontPicker";

interface StyleEditorProps {
  style: OverlayStyle;
  onStyleChange: (newStyle: OverlayStyle) => void;
  title: string;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ style, onStyleChange, title }) => {
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
    if (/^\d*\.?\d*$/.test(value)) {
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
        </div>
        <div className="space-y-2">
          <Label>Distance (px)</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[parseInt(String(style.distance || 0))]}
              onValueChange={(value) => handleSliderChange("distance", value)}
              max={400}
              min={0}
              step={1}
            />
            <Input
              type="text"
              value={style.distance !== undefined ? String(style.distance) : ""}
              onChange={(e) => handleNumericInputChange("distance", e.target.value)}
              className="w-20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Padding X (px)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[parseInt(String(style.paddingX || 0))]}
                onValueChange={(value) => handleSliderChange("paddingX", value)}
                max={200}
                min={0}
                step={1}
              />
              <Input
                type="text"
                value={style.paddingX !== undefined ? String(style.paddingX) : ""}
                onChange={(e) => handleNumericInputChange("paddingX", e.target.value)}
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Padding Y (px)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[parseInt(String(style.paddingY || 0))]}
                onValueChange={(value) => handleSliderChange("paddingY", value)}
                max={200}
                min={0}
                step={1}
              />
              <Input
                type="text"
                value={style.paddingY !== undefined ? String(style.paddingY) : ""}
                onChange={(e) => handleNumericInputChange("paddingY", e.target.value)}
                className="w-20"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4 items-center space-x-4">
            {/* Vertical Alignment */}
            <div className="space-y-2">
              <Label>Align Vertical</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={style.verticalAlignment || "center"}
                aria-label="Vertical alignment"
                onValueChange={(value: string) => {
                  if (value) handleValueChange("verticalAlignment", value);
                }}
              >
                <ToggleGroupItem value="top" aria-label="Align top">
                  <AlignVerticalDistributeStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" aria-label="Align center vertically">
                  <AlignVerticalDistributeCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="bottom" aria-label="Align bottom">
                  <AlignVerticalDistributeEnd className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Horizontal Alignment */}
            <div className="space-y-2">
              <Label>Align Horizontal</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={style.horizontalAlignment || "center"}
                aria-label="Horizontal alignment"
                onValueChange={(value: string) => {
                  if (value) handleValueChange("horizontalAlignment", value);
                }}
              >
                <ToggleGroupItem value="left" aria-label="Align left">
                  <AlignHorizontalDistributeStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" aria-label="Align center horizontally">
                  <AlignHorizontalDistributeCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="right" aria-label="Align right">
                  <AlignHorizontalDistributeEnd className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Inner Vertical Alignment</Label>
            <Select
              value={style.verticalAlign || "center"}
              onValueChange={(value) => handleValueChange("verticalAlign", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vertical alignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="baseline">Baseline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <hr />
        <div>
          <h3 className="text-lg font-medium mb-2">Title</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size (px)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[parseInt(String(style.title?.fontSize || 0))]}
                  onValueChange={(value) => handleSliderChange("title.fontSize", value)}
                  max={700}
                  min={0}
                  step={1}
                />
                <Input
                  type="text"
                  value={style.title?.fontSize !== undefined ? String(style.title.fontSize) : ""}
                  onChange={(e) => handleNumericInputChange("title.fontSize", e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <FontPicker
                  value={style.title?.fontFamily || ""}
                  onChange={(font) => handleValueChange("title.fontFamily", font)}
                  previewWord={title}
                  className="w-full h-10"
                ></FontPicker>
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
        </div>
        <hr />
        <div>
          <h3 className="text-lg font-medium mb-2">Number</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size (px)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[parseInt(String(style.counter?.fontSize || 0))]}
                  onValueChange={(value) => handleSliderChange("counter.fontSize", value)}
                  max={700}
                  min={0}
                  step={1}
                />
                <Input
                  type="text"
                  value={
                    style.counter?.fontSize !== undefined ? String(style.counter.fontSize) : ""
                  }
                  onChange={(e) => handleNumericInputChange("counter.fontSize", e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <FontPicker
                  value={style.counter?.fontFamily || ""}
                  onChange={(font) => handleValueChange("counter.fontFamily", font)}
                  previewWord={"0123456789"}
                  className="w-full h-10"
                ></FontPicker>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
