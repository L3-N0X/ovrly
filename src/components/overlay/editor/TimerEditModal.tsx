import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrismaElement } from "@/lib/types";
import React, { useState } from "react";

interface TimerEditModalProps {
  element: PrismaElement;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (elementId: string, update: { duration?: number; countDown?: boolean }) => void;
  onAddTime: (elementId: string, timeToAdd: number) => void;
}

export const TimerEditModal: React.FC<TimerEditModalProps> = ({
  element,
  isOpen,
  onClose,
  onUpdate,
  onAddTime,
}) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  if (!element.timer) return null;

  const handleAddTime = (multiplier: 1 | -1) => {
    const timeInMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
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
            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="seconds">Seconds</Label>
              <Input
                id="seconds"
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={() => handleAddTime(1)}>Add Time</Button>
            <Button onClick={() => handleAddTime(-1)} variant="outline">
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
