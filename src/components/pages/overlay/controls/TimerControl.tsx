import React from "react";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pause, Play, RotateCcw, Pencil } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import { useTimer } from "@/lib/hooks/useTimer";

interface TimerControlProps {
  element: PrismaElement;
  handleTimerToggle: (elementId: string) => void;
  handleTimerReset: (elementId: string) => void;
  setSelectedTimer: (timer: PrismaElement | null) => void;
  setIsTimerModalOpen: (isOpen: boolean) => void;
}

const formatTime = (milliseconds: number, format: string) => {
  if (milliseconds < 0) milliseconds = 0;
  const durationMoment = moment.duration(milliseconds);
  return moment.utc(durationMoment.asMilliseconds()).format(format);
};

// Declared at module level: a component defined inside another component's render is a new
// type on every render, so React would remount it (and reset its timer) on each update.
const TimerDisplay: React.FC<{ timer: PrismaElement["timer"]; format: string }> = ({
  timer,
  format,
}) => {
  const time = useTimer({
    startedAt: timer?.startedAt ? new Date(timer.startedAt) : null,
    pausedAt: timer?.pausedAt ? new Date(timer.pausedAt) : null,
    duration: timer?.duration ?? null,
    countDown: timer?.countDown ?? false,
  });
  return <>{formatTime(timer ? time : 0, format)}</>;
};

const TimerControl: React.FC<TimerControlProps> = ({
  element,
  handleTimerToggle,
  handleTimerReset,
  setSelectedTimer,
  setIsTimerModalOpen,
}) => {
  const format = (element.style as { format?: string })?.format || "HH:mm:ss";

  return (
    <div className="space-y-2">
      <Label htmlFor={`count-${element.id}`} className="text-sm font-medium">
        Timer:
        <span className="font-normal">{element.name}</span>
      </Label>
      <div className="flex items-center space-x-2">
        <div className="text-2xl font-mono bg-secondary h-14 flex items-center justify-center rounded-md px-4 flex-grow">
          <TimerDisplay timer={element.timer} format={format} />
        </div>
        <Button
          onClick={() => {
            setSelectedTimer(element);
            setIsTimerModalOpen(true);
          }}
          size="icon-lg"
          variant="secondary"
          className="h-14 w-14"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => handleTimerToggle(element.id)}
          size="icon-lg"
          variant="secondary"
          className="h-14 w-14"
        >
          {element.timer?.startedAt ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          onClick={() => handleTimerReset(element.id)}
          size="icon-lg"
          variant="secondary"
          className="h-14 w-14"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default TimerControl;
