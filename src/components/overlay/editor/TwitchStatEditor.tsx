import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { type PrismaElement, type TwitchStatStyle } from "@/lib/types";
import React from "react";
import { CounterStyleEditor } from "./CounterEditor";

const NUMBER_FORMATS = [
  { value: "full", label: "12,345" },
  { value: "compact", label: "12.3K" },
] as const;

// A Twitch stat looks like a counter, and big numbers can be shortened.
export const TwitchStatStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TwitchStatStyle) => void;
}> = ({ element, onChange }) => {
  const style = (element.style as TwitchStatStyle) || {};
  const id = `${element.id}-twitch-number-format`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id}>Number Format</Label>
        <SegmentedControl<NonNullable<TwitchStatStyle["numberFormat"]>>
          id={id}
          aria-label="Number format"
          value={style.numberFormat ?? "full"}
          onValueChange={(numberFormat) => onChange({ ...style, numberFormat })}
          options={NUMBER_FORMATS}
        />
      </div>
      <CounterStyleEditor element={element} onChange={onChange} />
    </div>
  );
};
