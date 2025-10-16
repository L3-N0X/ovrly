import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-2">
      <Label htmlFor={`count-${element.id}`} className="text-sm font-medium">
        Counter:
        <span className="font-normal">{element.name}</span>
      </Label>
      <div className="flex space-x-1">
        <Button
          onClick={() =>
            handleImmediateCounterChange(element.id, (element.counter?.value || 0) - 1)
          }
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 rounded-r-xs"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Input
          id={`count-${element.id}`}
          value={element.counter?.value || 0}
          onChange={(e) => handleCounterChange(element.id, parseInt(e.target.value, 10) || 0)}
          className="w-36 text-center text-2xl h-9 border-none rounded-l-xs rounded-r-xs"
        />
        <Button
          onClick={() =>
            handleImmediateCounterChange(element.id, (element.counter?.value || 0) + 1)
          }
          size="icon-lg"
          variant="secondary"
          className="h-9 w-9 rounded-l-xs"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CounterControl;
