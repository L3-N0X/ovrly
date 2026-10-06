import React, { useState } from "react";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Pencil } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import { useTimer } from "@/lib/hooks/useTimer";
import { TimerEditModal } from "@/components/overlay/editor/TimerEditModal";

interface TimerControlProps {
  element: PrismaElement;
  handleTimerToggle: (elementId: string) => void;
  handleTimerReset: (elementId: string) => void;
  handleTimerUpdate: (
    elementId: string,
    update: { duration?: number; countDown?: boolean }
  ) => void;
  handleTimerAddTime: (elementId: string, timeToAdd: number) => void;
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
  handleTimerUpdate,
  handleTimerAddTime,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const format = (element.style as { format?: string })?.format || "HH:mm:ss";

  return (
    <div className="flex items-center space-x-2">
      <div className="text-2xl font-mono bg-secondary h-12 flex items-center justify-center rounded-md px-3 flex-grow min-w-0">
        <TimerDisplay timer={element.timer} format={format} />
      </div>
      <Button
        onClick={() => setIsModalOpen(true)}
        title="Edit time"
        size="icon-lg"
        variant="secondary"
        className="h-12 w-12"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        onClick={() => handleTimerToggle(element.id)}
        title={element.timer?.startedAt ? "Pause" : "Start"}
        size="icon-lg"
        variant="secondary"
        className="h-12 w-12"
      >
        {element.timer?.startedAt ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <Button
        onClick={() => handleTimerReset(element.id)}
        title="Reset"
        size="icon-lg"
        variant="secondary"
        className="h-12 w-12"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
      {/* Gets the element on every render, so it always shows the current timer state. */}
      <TimerEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        element={element}
        onUpdate={handleTimerUpdate}
        onAddTime={handleTimerAddTime}
      />
    </div>
  );
};

export default TimerControl;
