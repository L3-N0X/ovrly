import React from "react";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import { progressMode, progressOf } from "@/lib/progress";
import type { PrismaElement, ProgressStyle } from "@/lib/types";

export type ProgressChange = { value?: number; max?: number; running?: boolean };

interface ProgressControlProps {
  element: PrismaElement;
  onProgressChange: (elementId: string, change: ProgressChange) => void;
}

// How far along a progress bar is. Each field can be bound on its own: a Spotify track's progress
// and length as value and maximum, and whether it plays as running.
const ProgressControl: React.FC<ProgressControlProps> = ({ element, onProgressChange }) => {
  const { value, max, running } = progressOf(element);
  const percent = progressMode(element.style as ProgressStyle | null) === "percent";
  const change = (next: ProgressChange) => onProgressChange(element.id, next);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <BindableField property="value" label="Value" htmlFor={`progress-value-${element.id}`}>
          <NumberField
            id={`progress-value-${element.id}`}
            value={value}
            min={0}
            max={percent ? 100 : undefined}
            unit={percent ? "%" : undefined}
            onChange={(next) => change({ value: next })}
          />
        </BindableField>
        {!percent && (
          <BindableField property="max" label="Maximum" htmlFor={`progress-max-${element.id}`}>
            <NumberField
              id={`progress-max-${element.id}`}
              value={max}
              min={1}
              onChange={(next) => next > 0 && change({ max: next })}
            />
          </BindableField>
        )}
      </div>
      <BindableField
        property="running"
        inline
        htmlFor={`progress-running-${element.id}`}
        label={
          <>
            Running
            <span className="ml-1 font-normal text-muted-foreground">(moves on between updates)</span>
          </>
        }
      >
        <Switch
          id={`progress-running-${element.id}`}
          checked={running}
          onCheckedChange={(next) => change({ running: next })}
        />
      </BindableField>
    </div>
  );
};

export default ProgressControl;
