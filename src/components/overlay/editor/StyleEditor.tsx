import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/Chip";
import { handleValueChange } from "./helper";
import { TitleStyleEditor } from "./TitleEditor";
import { CounterStyleEditor } from "./CounterEditor";

interface StyleEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ overlay, onOverlayChange }) => {
  const [expandedElementIds, setExpandedElementIds] = useState<Set<string>>(new Set());

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

  const toggleElementExpansion = (elementId: string) => {
    setExpandedElementIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

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
              <Label>Gap</Label>
              <div className="flex gap-4">
                <Slider
                  value={[
                    typeof overlay.globalStyle?.gap === "number" ? overlay.globalStyle.gap : 16,
                  ]}
                  onValueChange={(v) => updateGlobalStyle("gap", v[0])}
                  max={200}
                  min={0}
                />
                <Input
                  value={
                    typeof overlay.globalStyle?.gap === "number" ? overlay.globalStyle.gap : 16
                  }
                  onChange={(e) => {
                    if (e.target.value === "") {
                      updateGlobalStyle("gap", 0);
                      return;
                    }
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      updateGlobalStyle("gap", val);
                    }
                  }}
                  className="h-10 w-20"
                />
              </div>
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
              <Label>Padding</Label>
              <div className="flex gap-4">
                <Slider
                  value={[
                    typeof overlay.globalStyle?.padding === "number"
                      ? overlay.globalStyle.padding
                      : 0,
                  ]}
                  onValueChange={(v) => updateGlobalStyle("padding", v[0])}
                  max={300}
                  min={0}
                />
                <Input
                  value={
                    typeof overlay.globalStyle?.padding === "number"
                      ? overlay.globalStyle.padding
                      : 0
                  }
                  onChange={(e) => {
                    if (e.target.value === "") {
                      updateGlobalStyle("padding", 0);
                      return;
                    }
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      updateGlobalStyle("padding", val);
                    }
                  }}
                  className="h-10 w-20"
                />
              </div>
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
          </div>
        </div>

        <hr />

        {/* Elements List */}
        <div>
          <h3 className="text-lg font-medium mb-4">Elements</h3>
          <div className="space-y-2">
            {overlay.elements.map((element) => {
              const isExpanded = expandedElementIds.has(element.id);
              return (
                <div key={element.id}>
                  <div onClick={() => toggleElementExpansion(element.id)}>
                    <div
                      className={`flex p-3 gap-3 rounded-md hover:cursor-pointer hover:bg-accent
                        ${isExpanded ? "bg-muted" : ""}`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="h-6 w-6 mr-1" />
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-6 w-6 mr-1" />
                        </>
                      )}
                      <div className="flex items-center w-full justify-between">
                        <span className="text-lg font-medium">{element.name}</span>
                        <Chip className="ml-1 text-xs text-muted-foreground">{element.type}</Chip>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="animate-fadeIn overflow-hidden">
                      {element.type === ElementTypeEnum.TITLE && (
                        <TitleStyleEditor
                          element={element}
                          onChange={(style) => updateElementStyle(element.id, style)}
                        />
                      )}
                      {element.type === ElementTypeEnum.COUNTER && (
                        <CounterStyleEditor
                          element={element}
                          onChange={(style) => updateElementStyle(element.id, style)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <hr />

        {/* Expanded Element Editors will appear inline with each element */}
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
