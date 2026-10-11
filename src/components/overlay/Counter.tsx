import React from "react";
import type { CounterStyle } from "@/lib/types";
import { shadowStyle } from "./shadow";
import { textStyle } from "./textStyle";

interface CounterProps {
  value: number;
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
        ...shadowStyle(style, { box: !!style?.backgroundColor }),
      }}
    >
      {value}
    </div>
  );
};

export default Counter;