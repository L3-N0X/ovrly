import type React from "react";
import type { TimerStyle } from "@/lib/types";
import { textStyle } from "./textStyle";

// How timers and countdowns look on the canvas.
export const timerStyle = (style: TimerStyle | null | undefined): React.CSSProperties => ({
  ...textStyle(style, 128),
  backgroundColor: style?.backgroundColor,
  borderRadius: typeof style?.radius === "number" ? `${style.radius}px` : undefined,
  padding: typeof style?.padding === "number" ? `${style.padding}px` : undefined,
  transition: "all 0.2s ease-in-out",
});