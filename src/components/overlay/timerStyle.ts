import type React from "react";
import type { TimerStyle } from "@/lib/types";
import { textStyle } from "./textStyle";

// How timers and countdowns look on the canvas.
export const timerStyle = (style: TimerStyle | null | undefined): React.CSSProperties => {
  const legacyPadding = typeof style?.padding === "number" ? style.padding : undefined;
  const paddingX = typeof style?.paddingX === "number" ? style.paddingX : legacyPadding;
  const paddingY = typeof style?.paddingY === "number" ? style.paddingY : legacyPadding;

  return {
    ...textStyle(style, 128),
    backgroundColor: style?.backgroundColor,
    borderRadius: typeof style?.radius === "number" ? `${style.radius}px` : undefined,
    paddingLeft: paddingX === undefined ? undefined : `${paddingX}px`,
    paddingRight: paddingX === undefined ? undefined : `${paddingX}px`,
    paddingTop: paddingY === undefined ? undefined : `${paddingY}px`,
    paddingBottom: paddingY === undefined ? undefined : `${paddingY}px`,
    transition: "all 0.2s ease-in-out",
  };
};
