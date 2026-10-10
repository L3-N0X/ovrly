import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Pencil } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import { useTimer } from "@/lib/hooks/useTimer";
import { TimerEditModal } from "@/components/overlay/editor/TimerEditModal";
import { DEFAULT_DURATION_FORMAT, formatDuration } from "@/lib/duration";
import TimeReadout from "./TimeReadout";

interface TimerControlProps {
  element: PrismaElement;
  handleTimerToggle: (elementId: string) => void;
  handleTimerReset: (elementId: string) => void;
  handleTimerAddTime: (elementId: string, timeToAdd: number) => void;
}

const TimerControl: React.FC<TimerControlProps> = ({
  element,
  handleTimerToggle,
  handleTimerReset,
  handleTimerAddTime,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const format = (element.style as { format?: string })?.format || DEFAULT_DURATION_FORMAT;
  const timer = element.timer;
  const time = useTimer({
    startedAt: timer?.startedAt ? new Date(timer.startedAt) : null,
    pausedAt: timer?.pausedAt ? new Date(timer.pausedAt) : null,
  });

  return (
    <div className="flex items-center gap-1.5">
      <TimeReadout value={formatDuration(timer ? time : 0, format)} />
      <Button
        onClick={() => setIsModalOpen(true)}
        title="Edit time"
        size="icon"
        variant="secondary"
      >
        <Pencil />
      </Button>
      <Button
        onClick={() => handleTimerToggle(element.id)}
        title={element.timer?.startedAt ? "Pause" : "Start"}
        size="icon"
        variant="secondary"
      >
        {element.timer?.startedAt ? <Pause /> : <Play />}
      </Button>
      <Button
        onClick={() => handleTimerReset(element.id)}
        title="Reset"
        size="icon"
        variant="secondary"
      >
        <RotateCcw />
      </Button>
      {/* Gets the element on every render, so it always shows the current timer state. */}
      <TimerEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        element={element}
        onAddTime={handleTimerAddTime}
      />
    </div>
  );
};

export default TimerControl;
