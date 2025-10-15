import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";
import type { PrismaElement } from "@/lib/types";

interface CounterControlProps {
  element: PrismaElement;
  handleCounterChange: (elementId: string, value: number) => void;
}

const CounterControl: React.FC<CounterControlProps> = ({ element, handleCounterChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={`count-${element.id}`}>
        Counter: {element.name}
      </Label>
      <div className="flex space-x-2">
        <Button
          onClick={() =>
            handleCounterChange(
              element.id,
              (element.counter?.value || 0) - 1
            )
          }
          size="icon-lg"
          variant="secondary"
          className="h-14 w-14"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Input
          id={`count-${element.id}`}
          value={element.counter?.value || 0}
          onChange={(e) =>
            handleCounterChange(element.id, parseInt(e.target.value, 10) || 0)
          }
          className="w-36 text-center text-2xl h-14"
        />
        <Button
          onClick={() =>
            handleCounterChange(
              element.id,
              (element.counter?.value || 0) + 1
            )
          }
          size="icon-lg"
          variant="secondary"
          className="h-14 w-14"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CounterControl;
