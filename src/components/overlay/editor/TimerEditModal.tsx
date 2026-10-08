import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PrismaElement } from "@/lib/types";
import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { durationPartsToMs, ZERO_DURATION } from "@/lib/duration";
import { DurationFields } from "./DurationFields";

interface TimerEditModalProps {
  element: PrismaElement;
  isOpen: boolean;
  onClose: () => void;
  onAddTime: (elementId: string, timeToAdd: number) => void;
}

export const TimerEditModal: React.FC<TimerEditModalProps> = ({
  element,
  isOpen,
  onClose,
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
        <AddTimeForm
          idPrefix="timer"
          onAddTime={(ms) => {
            onAddTime(element.id, ms);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

// Hours, minutes and seconds with buttons to add or remove them. Enter adds the time.
export const AddTimeForm = ({
  idPrefix,
  onAddTime,
}: {
  idPrefix: string;
  onAddTime: (ms: number) => void;
}) => {
  const [time, setTime] = useState(ZERO_DURATION);
  const totalMs = durationPartsToMs(time);

  const apply = (multiplier: 1 | -1) => {
    if (totalMs === 0) return;
    onAddTime(totalMs * multiplier);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply(1);
      }}
    >
      <DurationFields idPrefix={idPrefix} value={time} onChange={setTime} autoFocus />
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
