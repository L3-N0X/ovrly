import React, { useState } from "react";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { formatDuration } from "@/lib/duration";
import { ADDED_VISIBLE_MS, formatAdded, subathonTiming } from "@/lib/subathon";
import type { PrismaElement, SubathonStyle } from "@/lib/types";
import { timerStyle } from "./timerStyle";

interface SubathonProps {
  subathon: NonNullable<PrismaElement["subathon"]>;
  style: SubathonStyle;
}

const Subathon: React.FC<SubathonProps> = ({ subathon, style }) => {
  const left = useCountdown(subathonTiming(subathon));
  // Additions from before the overlay was opened aren't shown again on a reload.
  const [openedAt] = useState(Date.now);
  const over = subathon.endsAt !== null && left === 0;
  const lastAddedAt = subathon.lastAddedAt ? new Date(subathon.lastAddedAt).getTime() : null;
  const showAdded =
    style?.showAdded !== false &&
    lastAddedAt !== null &&
    subathon.lastAddedMs > 0 &&
    lastAddedAt > openedAt - ADDED_VISIBLE_MS;

  return (
    <div style={{ ...timerStyle(style), position: "relative" }}>
      {over && style?.endedText ? style.endedText : formatDuration(left, style?.format)}
      {showAdded && (
        // Keyed by when it was added, so every addition plays the animation from the start.
        <span
          key={subathon.lastAddedAt}
          className="subathon-added"
          style={{ animationDuration: `${ADDED_VISIBLE_MS}ms` }}
        >
          {formatAdded(subathon.lastAddedMs)}
        </span>
      )}
    </div>
  );
};

export default Subathon;
