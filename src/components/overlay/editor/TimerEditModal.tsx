import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrismaElement } from "@/lib/types";
import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { NumberInputWithControls } from "@/components/ui/number-input-with-controls";

interface TimerEditModalProps {
  element: PrismaElement;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (elementId: string, update: { countDown: boolean }) => void;
  onAddTime: (elementId: string, timeToAdd: number) => void;
}

type Unit = "hours" | "minutes" | "seconds";
const UNITS: { unit: Unit; label: string }[] = [
  { unit: "hours", label: "Hours" },
  { unit: "minutes", label: "Minutes" },
  { unit: "seconds", label: "Seconds" },
];

export const TimerEditModal: React.FC<TimerEditModalProps> = ({
  element,
  isOpen,
  onClose,
  onUpdate,
  onAddTime,
}) => {
  if (!element.timer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust “{element.name}”</DialogTitle>
          <DialogDescription>Add time to the timer or take some away.</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so every opening starts at zero. */}
        <TimeForm element={element} onClose={onClose} onUpdate={onUpdate} onAddTime={onAddTime} />
      </DialogContent>
    </Dialog>
  );
};

// Enter adds the time and closes the dialog.
const TimeForm = ({
  element,
  onClose,
  onUpdate,
  onAddTime,
}: Omit<TimerEditModalProps, "isOpen">) => {
  const [time, setTime] = useState<Record<Unit, number>>({ hours: 0, minutes: 0, seconds: 0 });
  const totalMs = (time.hours * 3600 + time.minutes * 60 + time.seconds) * 1000;

  const apply = (multiplier: 1 | -1) => {
    if (totalMs === 0) return;
    onAddTime(element.id, totalMs * multiplier);
    onClose();
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply(1);
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {UNITS.map(({ unit, label }, index) => (
          <NumberInputWithControls
            key={unit}
            id={`timer-${unit}`}
            label={label}
            autoFocus={index === 0}
            value={time[unit]}
            onChange={(value) => setTime((current) => ({ ...current, [unit]: value }))}
            onIncrement={() => setTime((current) => ({ ...current, [unit]: current[unit] + 1 }))}
            onDecrement={() =>
              setTime((current) => ({ ...current, [unit]: Math.max(0, current[unit] - 1) }))
            }
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3 shadow-sm">
        <div className="space-y-0.5">
          <Label htmlFor="timer-count-down">Count down</Label>
          <p className="text-xs text-muted-foreground">Count down to zero instead of up.</p>
        </div>
        <Switch
          id="timer-count-down"
          checked={element.timer?.countDown ?? false}
          onCheckedChange={(checked) => onUpdate(element.id, { countDown: checked })}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => apply(-1)} disabled={totalMs === 0}>
          <Minus />
          Remove time
        </Button>
        <Button type="submit" disabled={totalMs === 0}>
          <Plus />
          Add time
        </Button>
      </DialogFooter>
    </form>
  );
};
