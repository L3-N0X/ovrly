import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Pencil, Play, RotateCcw } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import type { CountdownAction } from "@/lib/countdown";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { DEFAULT_DURATION_FORMAT, formatDuration } from "@/lib/duration";
import { CountdownEditModal } from "@/components/overlay/editor/CountdownEditModal";
import TimeReadout from "./TimeReadout";

interface CountdownControlProps {
  element: PrismaElement;
  onAction: (elementId: string, action: CountdownAction) => void;
}

const CountdownControl: React.FC<CountdownControlProps> = ({ element, onAction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const countdown = element.countdown;
  const format = (element.style as { format?: string })?.format || DEFAULT_DURATION_FORMAT;
  const left = useCountdown(countdown);
  // One counting down to a point in time runs on its own; it has nothing to start or reset.
  const isTarget = countdown?.mode === "TARGET";
  const running = !!countdown?.endsAt;

  return (
    <div className="flex items-center space-x-2">
      <TimeReadout
        value={formatDuration(left, format)}
        title={
          isTarget && countdown?.targetAt
            ? `Until ${new Date(countdown.targetAt).toLocaleString()}`
            : undefined
        }
      />
      <Button
        onClick={() => setIsModalOpen(true)}
        title="Edit countdown"
        size="icon-lg"
        variant="secondary"
        className="h-12 w-12"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      {!isTarget && (
        <>
          <Button
            onClick={() => onAction(element.id, { type: running ? "pause" : "start" })}
            title={running ? "Pause" : "Start"}
            size="icon-lg"
            variant="secondary"
            className="h-12 w-12"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            onClick={() => onAction(element.id, { type: "reset" })}
            title="Reset"
            size="icon-lg"
            variant="secondary"
            className="h-12 w-12"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </>
      )}
      {/* Gets the element on every render, so it always shows the current countdown. */}
      <CountdownEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        element={element}
        onAction={onAction}
      />
    </div>
  );
};

export default CountdownControl;
