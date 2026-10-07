import type React from "react";
import type { TimerStyle } from "@/lib/types";

// How timers and countdowns look on the canvas.
export const timerStyle = (style: TimerStyle | null | undefined): React.CSSProperties => {
  const safeStyle = style || {};
  return {
    fontSize: typeof safeStyle.fontSize === "number" ? `${safeStyle.fontSize}px` : "128px",
    lineHeight: 1,
    fontWeight: "700", // font-bold
    fontFamily: safeStyle.fontFamily,
    color: safeStyle.color || "#ffffff",
    backgroundColor: safeStyle.backgroundColor,
    borderRadius: typeof safeStyle.radius === "number" ? `${safeStyle.radius}px` : undefined,
    padding: typeof safeStyle.padding === "number" ? `${safeStyle.padding}px` : undefined,
    transition: "all 0.2s ease-in-out",
  };
};
