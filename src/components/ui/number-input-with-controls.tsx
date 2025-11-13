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
}

export const NumberInputWithControls: React.FC<NumberInputWithControlsProps> = ({
  id,
  label,
  value,
  onChange,
  onIncrement,
  onDecrement,
}) => {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center space-x-1">
        <Button
          onClick={onDecrement}
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 rounded-r-none border-input border"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="w-36 text-center text-2xl h-9 rounded-none bg-input/30 border-input"
        />
        <Button
          onClick={onIncrement}
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 rounded-l-none border-input border"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
