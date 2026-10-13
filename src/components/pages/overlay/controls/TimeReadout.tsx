import React, { useRef } from "react";
import { useFitText } from "@/lib/hooks/useFitText";

interface TimeReadoutProps {
  value: string;
  title?: string;
}

// The box a timer or countdown shows its time in. The value gets shorter or longer as it
// runs, so the text is scaled down to keep it on one line instead of wrapping.
const TimeReadout: React.FC<TimeReadoutProps> = ({ value, title }) => {
  const textRef = useRef<HTMLSpanElement>(null);
  useFitText(textRef, value);

  return (
    <div
      className="flex h-9 min-w-0 flex-grow items-center rounded-md bg-secondary px-2.5 font-mono text-base font-medium tabular-nums"
      title={title}
    >
      <span ref={textRef} className="block w-full truncate text-center">
        {value}
      </span>
    </div>
  );
};

export default TimeReadout;
