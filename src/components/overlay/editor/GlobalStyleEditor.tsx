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
import { type PrismaOverlay } from "@/lib/types";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
} from "lucide-react";
import React from "react";
import { Input } from "@/components/ui/input";
import { handleValueChange } from "./helper";
import { useSyncedSlider } from "@/lib/hooks/useSyncedSlider";

interface GlobalStyleEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  ws?: WebSocket | null;
}

export const GlobalStyleEditor: React.FC<GlobalStyleEditorProps> = ({
  overlay,
  onOverlayChange,
  ws = null,
}) => {
  const updateGlobalStyle = (path: string, value: string | number) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const newGlobalStyle = { ...(newOverlay.globalStyle || {}) };

    // Map the old property names to new ones for the update
    let newPropertyPath = path;
    switch (path) {
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

  // Synced sliders for improved responsiveness and websocket broadcasts.
  const syncedGap = useSyncedSlider(
    "global.gap",
    typeof overlay.globalStyle?.gap === "number" ? overlay.globalStyle.gap : 16,
    ws ?? null
  );
  const syncedPadding = useSyncedSlider(
    "global.padding",
    typeof overlay.globalStyle?.padding === "number" ? overlay.globalStyle.padding : 0,
    ws ?? null,
    { ignoreWindowMs: 300 }
  );

  return (
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
              value={[syncedGap.value]}
              onValueChange={(v) => {
                const val = v[0];
                syncedGap.onChange(val);
                updateGlobalStyle("gap", val);
              }}
              onPointerDown={syncedGap.onInteractionStart}
              onValueCommit={syncedGap.onInteractionEnd}
              max={200}
              min={0}
            />
            <Input
              value={syncedGap.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  syncedGap.onChange(0);
                  updateGlobalStyle("gap", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  syncedGap.onChange(val);
                  updateGlobalStyle("gap", val);
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Container Alignment - Vertical</Label>
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
          <Label>Container Alignment - Horizontal</Label>
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
              value={[syncedPadding.value]}
              onValueChange={(v) => {
                const val = v[0];
                syncedPadding.onChange(val);
                updateGlobalStyle("padding", val);
              }}
              onPointerDown={syncedPadding.onInteractionStart}
              onValueCommit={syncedPadding.onInteractionEnd}
              max={300}
              min={0}
            />
            <Input
              value={syncedPadding.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  syncedPadding.onChange(0);
                  updateGlobalStyle("padding", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  syncedPadding.onChange(val);
                  updateGlobalStyle("padding", val);
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Element Alignment - Vertical</Label>
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
  );
};
