import { ColorField } from "@/components/ui/color-picker";
import { NumberField } from "@/components/ui/number-field";
import { BindableField } from "@/components/variables/BindableField";
import React from "react";

/**
 * A labelled pixel count. Without `min`, negative values are allowed too. With `property` (as
 * lib/bindings.ts names it) it can be bound to a number variable.
 */
export const PixelInput: React.FC<{
  id: string;
  label: string;
  property?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({ id, label, property, value, min, max, onChange }) => (
  <BindableField property={property} label={label} htmlFor={id}>
    <NumberField
      id={id}
      value={value}
      min={min}
      max={max}
      unit="px"
      onChange={onChange}
    />
  </BindableField>
);

/**
 * A labelled colour. `value` is empty for "none"; pass `onClear` when the colour can be absent
 * to get the button that removes it again. With `property` it can be bound to a color variable.
 */
export const ColorInput: React.FC<{
  id: string;
  label: string;
  property?: string;
  value: string;
  /** Where the picker starts when `value` is empty. */
  defaultColor: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onClear?: () => void;
}> = ({ id, label, property, value, defaultColor, onChange, onOpenChange, onClear }) => (
  <BindableField property={property} label={label} htmlFor={id}>
    <ColorField
      id={id}
      value={value}
      defaultColor={defaultColor}
      onChange={onChange}
      // Style updates are merged on the server, so an omitted key wouldn't clear it.
      onClear={onClear}
      onOpenChange={onOpenChange}
    />
  </BindableField>
);
