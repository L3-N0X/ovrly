import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import type { PrismaElement } from "@/lib/types";

interface CounterControlProps {
  element: PrismaElement;
  handleCounterChange: (elementId: string, value: number) => void;
  handleImmediateCounterChange: (elementId: string, value: number) => void;
}

const CounterControl: React.FC<CounterControlProps> = ({
  element,
  handleCounterChange,
  handleImmediateCounterChange,
}) => {
  return (
    <div className="flex space-x-1">
      <Button
        onClick={() => handleImmediateCounterChange(element.id, (element.counter?.value || 0) - 1)}
        size="icon-lg"
        variant="secondary"
        className="h-10 w-12 rounded-r-xs border-input border"
        aria-label="Decrease"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Input
        id={`count-${element.id}`}
        aria-label={`${element.name} value`}
        value={element.counter?.value || 0}
        onChange={(e) => handleCounterChange(element.id, parseInt(e.target.value, 10) || 0)}
        className="flex-1 text-center text-2xl h-10 rounded-l-xs rounded-r-xs bg-input/30 border-input"
      />
      <Button
        onClick={() => handleImmediateCounterChange(element.id, (element.counter?.value || 0) + 1)}
        size="icon-lg"
        variant="secondary"
        className="h-10 w-12 rounded-l-xs border-input border"
        aria-label="Increase"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default CounterControl;
