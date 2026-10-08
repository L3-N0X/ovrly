import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";

interface NumberInputWithControlsProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  autoFocus?: boolean;
}

// A number field with - and + buttons. The buttons are for the pointer: from the keyboard,
// Tab goes from field to field and the arrow keys count up and down.
export const NumberInputWithControls: React.FC<NumberInputWithControlsProps> = ({
  id,
  label,
  value,
  onChange,
  onIncrement,
  onDecrement,
  autoFocus,
}) => {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center">
        <Button
          type="button"
          tabIndex={-1}
          aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={onDecrement}
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 shrink-0 rounded-r-none border border-input"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          id={id}
          inputMode="numeric"
          autoFocus={autoFocus}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") onIncrement();
            else if (e.key === "ArrowDown") onDecrement();
            else return;
            e.preventDefault();
          }}
          className="h-9 min-w-0 flex-1 rounded-none border-x-0 border-input bg-input/30 text-center text-xl tabular-nums"
        />
        <Button
          type="button"
          tabIndex={-1}
          aria-label={`More ${label.toLowerCase()}`}
          onClick={onIncrement}
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 shrink-0 rounded-l-none border border-input"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
