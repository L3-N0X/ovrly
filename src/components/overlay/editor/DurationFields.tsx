import React from "react";
import { NumberInputWithControls } from "@/components/ui/number-input-with-controls";
import type { DurationParts } from "@/lib/duration";

const UNITS: { unit: keyof DurationParts; label: string }[] = [
  { unit: "hours", label: "Hours" },
  { unit: "minutes", label: "Minutes" },
  { unit: "seconds", label: "Seconds" },
];

// Hours, minutes and seconds side by side, for entering a length of time.
export const DurationFields: React.FC<{
  idPrefix: string;
  value: DurationParts;
  onChange: (update: (current: DurationParts) => DurationParts) => void;
  autoFocus?: boolean;
}> = ({ idPrefix, value, onChange, autoFocus }) => (
  <div className="grid grid-cols-3 gap-2">
    {UNITS.map(({ unit, label }, index) => (
      <NumberInputWithControls
        key={unit}
        id={`${idPrefix}-${unit}`}
        label={label}
        autoFocus={autoFocus && index === 0}
        value={value[unit]}
        onChange={(next) => onChange((current) => ({ ...current, [unit]: next }))}
        onIncrement={() => onChange((current) => ({ ...current, [unit]: current[unit] + 1 }))}
        onDecrement={() =>
          onChange((current) => ({ ...current, [unit]: Math.max(0, current[unit] - 1) }))
        }
      />
    ))}
  </div>
);
