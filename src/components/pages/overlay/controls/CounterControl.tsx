import React from "react";
import { BindableField } from "@/components/variables/BindableField";
import { Minus, Plus } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CounterControlProps {
  element: PrismaElement;
  handleCounterChange: (elementId: string, value: number) => void;
  handleCounterIncrement: (elementId: string, increment: number) => void;
}

const STEP_BUTTON =
  "flex w-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-primary/20 disabled:pointer-events-none";

const CounterControl: React.FC<CounterControlProps> = ({
  element,
  handleCounterChange,
  handleCounterIncrement,
}) => {
  // While bound to a variable, the variable gives the value and replaces the buttons.
  return (
    <BindableField property="value" label="Value" htmlFor={`count-${element.id}`}>
      {/* One field with the steps on either side, like the number fields in the style editor. */}
      <div className="flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-input/30 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-ring/60">
        <button
          type="button"
          onClick={() => handleCounterIncrement(element.id, -1)}
          className={cn(STEP_BUTTON, "border-r border-input")}
          title="Decrease"
          aria-label="Decrease"
        >
          <Minus className="size-4" />
        </button>
        <input
          id={`count-${element.id}`}
          aria-label={`${element.name} value`}
          inputMode="numeric"
          autoComplete="off"
          value={element.counter?.value || 0}
          onChange={(e) => handleCounterChange(element.id, parseInt(e.target.value, 10) || 0)}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-medium tabular-nums outline-none selection:bg-primary selection:text-primary-foreground"
        />
        <button
          type="button"
          onClick={() => handleCounterIncrement(element.id, 1)}
          className={cn(STEP_BUTTON, "border-l border-input")}
          title="Increase"
          aria-label="Increase"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </BindableField>
  );
};

export default CounterControl;
