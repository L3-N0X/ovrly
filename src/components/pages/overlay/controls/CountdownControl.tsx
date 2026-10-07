import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Pencil, Play, RotateCcw } from "lucide-react";
import type { PrismaElement } from "@/lib/types";
import type { CountdownAction } from "@/lib/countdown";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { DEFAULT_DURATION_FORMAT, formatDuration } from "@/lib/duration";
import { CountdownEditModal } from "@/components/overlay/editor/CountdownEditModal";

interface CountdownControlProps {
  element: PrismaElement;
  onAction: (elementId: string, action: CountdownAction) => void;
}

// Declared at module level: a component defined inside another component's render is a new
// type on every render, so React would remount it (and reset its interval) on each update.
const CountdownDisplay: React.FC<{ countdown: PrismaElement["countdown"]; format: string }> = ({
  countdown,
  format,
}) => {
  const left = useCountdown(countdown);
  return <>{formatDuration(left, format)}</>;
};

const CountdownControl: React.FC<CountdownControlProps> = ({ element, onAction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const countdown = element.countdown;
  const format = (element.style as { format?: string })?.format || DEFAULT_DURATION_FORMAT;
  // One counting down to a point in time runs on its own; it has nothing to start or reset.
  const isTarget = countdown?.mode === "TARGET";
  const running = !!countdown?.endsAt;

  return (
    <div className="flex items-center space-x-2">
      <div
        className="text-2xl font-mono bg-secondary h-12 flex items-center justify-center rounded-md px-3 flex-grow min-w-0"
        title={
          isTarget && countdown?.targetAt
            ? `Until ${new Date(countdown.targetAt).toLocaleString()}`
            : undefined
        }
      >
        <CountdownDisplay countdown={countdown} format={format} />
      </div>
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
