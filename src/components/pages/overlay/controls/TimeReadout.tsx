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
      className="text-2xl font-mono bg-secondary h-12 flex items-center rounded-md px-3 flex-grow min-w-0"
      title={title}
    >
      <span ref={textRef} className="block w-full text-center truncate">
        {value}
      </span>
    </div>
  );
};

export default TimeReadout;