import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrismaElement } from "@/lib/types";
import React, { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { NumberInputWithControls } from "@/components/ui/number-input-with-controls";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

interface TimerEditModalProps {
  element: PrismaElement;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (elementId: string, update: { countDown: boolean }) => void;
  onAddTime: (elementId: string, timeToAdd: number) => void;
}

export const TimerEditModal: React.FC<TimerEditModalProps> = ({
  element,
  isOpen,
  onClose,
  onUpdate,
  onAddTime,
}) => {
  // A new open/closed session starts with empty fields; edits remain local within that session.
  const initialTime = useMemo(
    () => ({ isOpen, hours: 0, minutes: 0, seconds: 0 }),
    [isOpen]
  );
  const { value: time, setValue: setTime } = useLocalCopy(initialTime);

  if (!element.timer) return null;

  const handleAddTime = (multiplier: 1 | -1) => {
    const timeInMs = (time.hours * 3600 + time.minutes * 60 + time.seconds) * 1000;
    onAddTime(element.id, timeInMs * multiplier);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-description="Change the timers time">
        <DialogHeader>
          <DialogTitle>Edit Timer: {element.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <NumberInputWithControls
              id="hours"
              label="Hours"
              value={time.hours}
              onChange={(hours) => setTime((current) => ({ ...current, hours }))}
              onIncrement={() => setTime((current) => ({ ...current, hours: current.hours + 1 }))}
              onDecrement={() =>
                setTime((current) => ({ ...current, hours: Math.max(0, current.hours - 1) }))
              }
            />
            <NumberInputWithControls
              id="minutes"
              label="Minutes"
              value={time.minutes}
              onChange={(minutes) => setTime((current) => ({ ...current, minutes }))}
              onIncrement={() =>
                setTime((current) => ({ ...current, minutes: current.minutes + 1 }))
              }
              onDecrement={() =>
                setTime((current) => ({ ...current, minutes: Math.max(0, current.minutes - 1) }))
              }
            />
            <NumberInputWithControls
              id="seconds"
              label="Seconds"
              value={time.seconds}
              onChange={(seconds) => setTime((current) => ({ ...current, seconds }))}
              onIncrement={() =>
                setTime((current) => ({ ...current, seconds: current.seconds + 1 }))
              }
              onDecrement={() =>
                setTime((current) => ({ ...current, seconds: Math.max(0, current.seconds - 1) }))
              }
            />
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={() => handleAddTime(1)} variant="outline">
              <Plus />
              Add Time
            </Button>
            <Button onClick={() => handleAddTime(-1)} variant="outline">
              <Minus />
              Remove Time
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Count Down</Label>
              <p className="text-xs text-muted-foreground">
                Invert the timer to count down to zero.
              </p>
            </div>
            <Switch
              checked={element.timer.countDown}
              onCheckedChange={(checked) => onUpdate(element.id, { countDown: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
