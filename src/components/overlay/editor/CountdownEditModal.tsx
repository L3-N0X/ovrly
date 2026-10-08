import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CountdownAction, CountdownState } from "@/lib/countdown";
import { MAX_DURATION_MS } from "@/lib/countdown";
import type { PrismaElement } from "@/lib/types";
import React, { useState } from "react";
import { CalendarClock, Hourglass } from "lucide-react";
import { AddTimeForm } from "./TimerEditModal";
import { durationPartsToMs, msToDurationParts } from "@/lib/duration";
import { DurationFields } from "./DurationFields";

interface CountdownEditModalProps {
  element: PrismaElement;
  isOpen: boolean;
  onClose: () => void;
  onAction: (elementId: string, action: CountdownAction) => void;
}

type Tab = "adjust" | "duration" | "target";

const TABS = [
  { value: "adjust", label: "Add or remove" },
  { value: "duration", label: "Count down from" },
  { value: "target", label: "Count down to" },
] as const;

const DESCRIPTIONS: Record<Tab, string> = {
  adjust: "Add time to the countdown or take some away.",
  duration: "Count down a length of time. You start, pause and reset it.",
  target: "Count down to a date and time. It runs on its own until then.",
};

// `datetime-local` inputs take the local time without a zone: "2026-10-07T20:00".
const toLocalInput = (ms: number) => {
  const date = new Date(ms);
  return new Date(ms - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

// The next full hour, at least half an hour away: a sensible first guess for a stream start.
const suggestedTarget = () => {
  const date = new Date(Date.now() + 30 * 60_000);
  date.setMinutes(60, 0, 0);
  return date.getTime();
};

export const CountdownEditModal: React.FC<CountdownEditModalProps> = ({
  element,
  isOpen,
  onClose,
  onAction,
}) => {
  if (!element.countdown) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted with the dialog, so every opening starts from the countdown as it is. */}
        <CountdownForms
          element={element}
          countdown={element.countdown}
          onAction={(action) => {
            onAction(element.id, action);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

const CountdownForms = ({
  element,
  countdown,
  onAction,
}: {
  element: PrismaElement;
  countdown: CountdownState;
  onAction: (action: CountdownAction) => void;
}) => {
  // One without an end time yet has nothing to add to.
  const [tab, setTab] = useState<Tab>(
    countdown.mode === "TARGET" && !countdown.targetAt ? "target" : "adjust"
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust “{element.name}”</DialogTitle>
        <DialogDescription>{DESCRIPTIONS[tab]}</DialogDescription>
      </DialogHeader>
      <SegmentedControl
        aria-label="What to change"
        value={tab}
        onValueChange={setTab}
        options={TABS}
        className="w-full [&>*]:flex-1"
      />
      {tab === "adjust" && (
        <AddTimeForm idPrefix="countdown" onAddTime={(ms) => onAction({ type: "addTime", ms })} />
      )}
      {tab === "duration" && <DurationForm countdown={countdown} onAction={onAction} />}
      {tab === "target" && <TargetForm countdown={countdown} onAction={onAction} />}
    </>
  );
};

const DurationForm = ({
  countdown,
  onAction,
}: {
  countdown: CountdownState;
  onAction: (action: CountdownAction) => void;
}) => {
  const [time, setTime] = useState(() => msToDurationParts(countdown.duration));
  const totalMs = durationPartsToMs(time);
  const tooLong = totalMs > MAX_DURATION_MS;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (totalMs > 0 && !tooLong) onAction({ type: "setDuration", ms: totalMs });
      }}
    >
      <DurationFields idPrefix="countdown-duration" value={time} onChange={setTime} autoFocus />
      <p className="text-xs text-muted-foreground">
        {tooLong
          ? "That's longer than 24 days. Count down to a date and time instead."
          : "Resets the countdown to this length. Start it whenever you're ready."}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={totalMs === 0 || tooLong}>
          <Hourglass />
          Count down from this
        </Button>
      </DialogFooter>
    </form>
  );
};

const TargetForm = ({
  countdown,
  onAction,
}: {
  countdown: CountdownState;
  onAction: (action: CountdownAction) => void;
}) => {
  const [value, setValue] = useState(() =>
    toLocalInput(countdown.targetAt ? new Date(countdown.targetAt).getTime() : suggestedTarget())
  );
  // When the form was opened, which is close enough to tell a time that has passed.
  const [openedAt] = useState(Date.now);
  const at = value ? new Date(value).getTime() : NaN;
  const valid = !Number.isNaN(at);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAction({ type: "setTarget", at });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="countdown-target">Ends at</Label>
        <Input
          id="countdown-target"
          type="datetime-local"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {valid && at <= openedAt
          ? "This time has already passed, so the countdown will show zero."
          : "In your time zone. The countdown reaches zero at that moment for everyone."}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={!valid}>
          <CalendarClock />
          Count down to this
        </Button>
      </DialogFooter>
    </form>
  );
};
