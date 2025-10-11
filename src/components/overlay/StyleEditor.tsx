import React, { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Plus,
  Trash2,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type PrismaOverlay,
  ElementTypeEnum,
  type ElementType,
  type PrismaElement,
  type BaseElementStyle,
  type CounterStyle,
  type ElementStyle,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FontPicker } from "../FontPicker";

// Helper to handle nested property changes
const handleValueChange = (obj: object, path: string, value: unknown) => {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
};

// ==================================
//      ELEMENT-SPECIFIC EDITORS
// ==================================

const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: BaseElementStyle) => void;
}> = ({ element, onChange }) => {
  const [color, setColor] = useColor((element.style as BaseElementStyle)?.color || "#ffffff");

  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = element.style as BaseElementStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-semibold">Edit: {element.name}</h4>
      <div className="space-y-2">
        <Label>Font Size (px)</Label>
        <Slider
          value={[style?.fontSize || 36]}
          onValueChange={(v) => updateStyle("fontSize", v[0])}
          max={200}
          min={8}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            onChange={(font) => updateStyle("fontFamily", font)}
            className="w-full h-10"
            previewWord={element.title?.text}
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
      </div>
    </div>
  );
};

const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
}> = ({ element, onChange }) => {
  const [color, setColor] = useColor((element.style as CounterStyle)?.color || "#ffffff");
  const [bgColor, setBgColor] = useColor(
    (element.style as CounterStyle)?.backgroundColor || "#333333"
  );

  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = element.style as CounterStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-semibold">Edit: {element.name}</h4>
      <div className="space-y-2">
        <Label>Font Size (px)</Label>
        <Slider
          value={[style?.fontSize || 128]}
          onValueChange={(v) => updateStyle("fontSize", v[0])}
          max={400}
          min={8}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            onChange={(font) => updateStyle("fontFamily", font)}
            previewWord="1234567890"
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
          <Label>Padding (px)</Label>
          <Slider
            value={[(element.style as CounterStyle)?.padding || 0]}
            onValueChange={(v) => updateStyle("padding", v[0])}
            max={100}
          />
        </div>
        <div className="space-y-2">
          <Label>Corner Radius (px)</Label>
          <Slider
            value={[(element.style as CounterStyle)?.radius || 0]}
            onValueChange={(v) => updateStyle("radius", v[0])}
            max={100}
          />
        </div>
      </div>
    </div>
  );
};

// ==================================
//      MAIN STYLE EDITOR
// ==================================

interface StyleEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  onAddElement: (type: ElementType, name: string) => void;
  onDeleteElement: (elementId: string) => void;
}

const StyleEditor: React.FC<StyleEditorProps> = ({
  overlay,
  onOverlayChange,
  onAddElement,
  onDeleteElement,
}) => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [newElementName, setNewElementName] = useState("");
  const [newElementType, setNewElementType] = useState<ElementType>(ElementTypeEnum.COUNTER);

  const updateGlobalStyle = (path: string, value: string | number) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const newGlobalStyle = { ...(newOverlay.globalStyle || {}) };

    // Map the old property names to new ones for the update
    let newPropertyPath = path;
    switch (path) {
      case "groupJustifyContent":
        newPropertyPath = "outerJustifyContent";
        break;
      case "groupAlignItems":
        newPropertyPath = "outerAlignItems";
        break;
      case "justifyContent":
        newPropertyPath = "innerJustifyContent";
        break;
      case "alignItems":
        newPropertyPath = "innerAlignItems";
        break;
    }

    // Set only the new property
    handleValueChange(newGlobalStyle, newPropertyPath, value);

    newOverlay.globalStyle = newGlobalStyle;
    onOverlayChange(newOverlay);
  };

  const updateElementStyle = (elementId: string, newStyle: ElementStyle) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementIndex = newOverlay.elements.findIndex((el: PrismaElement) => el.id === elementId);
    if (elementIndex > -1) {
      newOverlay.elements[elementIndex].style = newStyle;
      onOverlayChange(newOverlay);
    }
  };

  const handleAddNewElement = () => {
    if (newElementName.trim()) {
      onAddElement(newElementType, newElementName.trim());
      setNewElementName("");
    }
  };

  const selectedElement = overlay.elements.find((el) => el.id === selectedElementId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the look and feel of your overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Styles */}
        <div>
          <h3 className="text-lg font-medium mb-4">Global Layout</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arrangement</Label>
              <Select
                value={overlay.globalStyle?.flexDirection || "column"}
                onValueChange={(v) => updateGlobalStyle("flexDirection", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="column">Column</SelectItem>
                  <SelectItem value="row">Row</SelectItem>
                  <SelectItem value="column-reverse">Column Reversed</SelectItem>
                  <SelectItem value="row-reverse">Row Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gap (px)</Label>
              <Slider
                value={[overlay.globalStyle?.gap || 16]}
                onValueChange={(v) => updateGlobalStyle("gap", v[0])}
                max={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Outer Container Alignment - Vertical</Label>
              <ToggleGroup
                type="single"
                value={overlay.globalStyle?.outerAlignItems || "center"}
                onValueChange={(v) => v && updateGlobalStyle("outerAlignItems", v)}
                className="w-full"
                variant="outline"
              >
                <ToggleGroupItem value="flex-start" className="w-full">
                  <AlignVerticalJustifyStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="w-full">
                  <AlignVerticalJustifyCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="flex-end" className="w-full">
                  <AlignVerticalJustifyEnd className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label>Outer Container Alignment - Horizontal</Label>
              <ToggleGroup
                type="single"
                value={overlay.globalStyle?.outerJustifyContent || "center"}
                onValueChange={(v) => v && updateGlobalStyle("outerJustifyContent", v)}
                className="w-full"
                variant="outline"
              >
                <ToggleGroupItem value="flex-start" className="w-full">
                  <AlignHorizontalJustifyStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="w-full">
                  <AlignHorizontalJustifyCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="flex-end" className="w-full">
                  <AlignHorizontalJustifyEnd className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label>Padding (px)</Label>
              <Slider
                value={[overlay.globalStyle?.padding || 0]}
                onValueChange={(v) => updateGlobalStyle("padding", v[0])}
                max={200}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Inner Group Alignment - Vertical (Elements in Row) / Horizontal (Elements in Column)
              </Label>
              <ToggleGroup
                type="single"
                value={overlay.globalStyle?.innerAlignItems || "baseline"}
                onValueChange={(v) => v && updateGlobalStyle("innerAlignItems", v)}
                className="w-full"
                variant="outline"
              >
                <ToggleGroupItem value="flex-start" className="w-full">
                  <AlignVerticalJustifyStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="w-full">
                  <AlignVerticalJustifyCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="flex-end" className="w-full">
                  <AlignVerticalJustifyEnd className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="baseline" className="w-full">
                  <Baseline className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {/* Not needed and not working, do not use
             <div className="space-y-2">
              <Label>Inner Group Alignment - Horizontal (Elements in Row) / Vertical (Elements in Column)</Label>
              <ToggleGroup
                type="single"
                value={overlay.globalStyle?.innerJustifyContent || "flex-start"}
                onValueChange={(v) => v && updateGlobalStyle("innerJustifyContent", v)}
                className="w-full"
                variant="outline"
              >
                <ToggleGroupItem value="flex-start" className="w-full">
                  <AlignHorizontalJustifyStart className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="w-full">
                  <AlignHorizontalJustifyCenter className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="flex-end" className="w-full">
                  <AlignHorizontalJustifyEnd className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div> */}
          </div>
        </div>

        <hr />

        {/* Elements List */}
        <div>
          <h3 className="text-lg font-medium mb-4">Elements</h3>
          <div className="space-y-2">
            {overlay.elements.map((element) => (
              <div
                key={element.id}
                className={`flex items-center justify-between p-2 rounded-md ${
                  selectedElementId === element.id ? "bg-muted" : ""
                }`}
              >
                <span>
                  {element.name}{" "}
                  <span className="text-xs text-muted-foreground">({element.type})</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedElementId(selectedElementId === element.id ? null : element.id)
                    }
                  >
                    {selectedElementId === element.id ? "Close" : "Edit"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => onDeleteElement(element.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Input
              placeholder="New element name..."
              value={newElementName}
              onChange={(e) => setNewElementName(e.target.value)}
            />
            <Select value={newElementType} onValueChange={(v: ElementType) => setNewElementType(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ElementTypeEnum.COUNTER}>Counter</SelectItem>
                <SelectItem value={ElementTypeEnum.TITLE}>Title</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddNewElement}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <hr />

        {/* Selected Element Editor */}
        {selectedElement && (
          <div>
            {selectedElement.type === ElementTypeEnum.TITLE && (
              <TitleStyleEditor
                element={selectedElement}
                onChange={(style) => updateElementStyle(selectedElement.id, style)}
              />
            )}
            {selectedElement.type === ElementTypeEnum.COUNTER && (
              <CounterStyleEditor
                element={selectedElement}
                onChange={(style) => updateElementStyle(selectedElement.id, style)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
