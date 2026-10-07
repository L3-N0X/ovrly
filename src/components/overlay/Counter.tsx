import React from "react";
import type { CounterStyle } from "@/lib/types";
import { textStyle } from "./textStyle";

interface CounterProps {
  // Already formatted when it isn't a plain number (Twitch stats).
  value: number | string;
  style: CounterStyle;
}

const Counter: React.FC<CounterProps> = ({ value, style }) => {
  const counterStyle = textStyle(style, 128);

  return (
    <div
      style={{
        ...counterStyle,
        backgroundColor: style?.backgroundColor,
        borderRadius: typeof style?.radius === "number" ? `${style.radius}px` : undefined,
        padding: typeof style?.padding === "number" ? `${style.padding}px` : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {value}
    </div>
  );
};

export default Counter;