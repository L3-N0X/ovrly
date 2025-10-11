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
import type { OverlayStyle } from "./DisplayCounter";
import { ColorPicker, useColor } from "react-color-palette";
import "react-color-palette/css";

interface StyleEditorProps {
  style: OverlayStyle;
  onStyleChange: (newStyle: OverlayStyle) => void;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ style, onStyleChange }) => {
  const handleValueChange = (path: string, value: string) => {
    const keys = path.split(".");
    const newStyle = JSON.parse(JSON.stringify(style));
    let current = newStyle;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value === "" ? undefined : value;
    onStyleChange(newStyle);
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
            <Label>Distance</Label>
            <Input
              value={style.distance || ""}
              onChange={(e) => handleValueChange("distance", e.target.value)}
              placeholder="e.g., 1rem, 16px"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Title</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Input
                value={style.title?.fontSize || ""}
                onChange={(e) => handleValueChange("title.fontSize", e.target.value)}
                placeholder="e.g., 2.25rem"
              />
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
              <Input
                type="color"
                value={style.title?.color || "#000000"}
                onChange={(e) => handleValueChange("title.color", e.target.value)}
                className="p-1"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Number</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Input
                value={style.counter?.fontSize || ""}
                onChange={(e) => handleValueChange("counter.fontSize", e.target.value)}
                placeholder="e.g., 8rem"
              />
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
              <Input
                type="color"
                value={style.counter?.color || "#000000"}
                onChange={(e) => handleValueChange("counter.color", e.target.value)}
                className="p-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
