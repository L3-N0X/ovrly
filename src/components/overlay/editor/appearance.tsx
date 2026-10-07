import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import React from "react";

/** A labelled pixel count. Without `min`, negative values are allowed too. */
export const PixelInput: React.FC<{
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({ id, label, value, min, max, onChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <NumberField
      id={id}
      value={value}
      min={min}
      max={max}
      unit="px"
      onChange={onChange}
    />
  </div>
);

/**
 * A labelled colour. `value` is empty for "none"; pass `onClear` when the colour can be absent
 * to get the button that removes it again.
 */
export const ColorInput: React.FC<{
  id: string;
  label: string;
  value: string;
  /** Where the picker starts when `value` is empty. */
  defaultColor: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onClear?: () => void;
}> = ({ id, label, value, defaultColor, onChange, onOpenChange, onClear }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <ColorField
      id={id}
      value={value}
      defaultColor={defaultColor}
      onChange={onChange}
      // Style updates are merged on the server, so an omitted key wouldn't clear it.
      onClear={onClear}
      onOpenChange={onOpenChange}
    />
  </div>
);
