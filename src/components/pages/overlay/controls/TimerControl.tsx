import React, { useCallback } from "react";
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

const TimerControl: React.FC<TimerControlProps> = ({
  element,
  handleTimerToggle,
  handleTimerReset,
  setSelectedTimer,
  setIsTimerModalOpen,
}) => {
  const formatTime = useCallback(
    (milliseconds: number) => {
      if (milliseconds < 0) milliseconds = 0;
      const durationMoment = moment.duration(milliseconds);
      const format = (element.style as any)?.format || "HH:mm:ss";
      return moment.utc(durationMoment.asMilliseconds()).format(format);
    },
    [element.style]
  );

  const TimerRenderer: React.FC<{ timer: NonNullable<PrismaElement["timer"]> }> = ({ timer }) => {
    const time = useTimer({
      ...timer,
      startedAt: timer.startedAt ? new Date(timer.startedAt) : null,
      pausedAt: timer.pausedAt ? new Date(timer.pausedAt) : null,
    });
    return <>{formatTime(time)}</>;
  };

  const TimerDisplay: React.FC<{ timerElement: PrismaElement }> = ({ timerElement }) => {
    if (!timerElement.timer) {
      return <>{formatTime(0)}</>;
    }
    return <TimerRenderer timer={timerElement.timer} />;
  };

  return (
    <div className="space-y-2">
      <Label>Timer: {element.name}</Label>
      <div className="flex items-center space-x-2">
        <div className="text-2xl font-mono bg-secondary h-14 flex items-center justify-center rounded-md px-4 flex-grow">
          <TimerDisplay timerElement={element} />
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
          {element.timer?.startedAt ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
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
