import React from "react";

interface CounterStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  radius?: number;
  padding?: number;
}

interface CounterProps {
  value: number;
  style: CounterStyle;
}

const Counter: React.FC<CounterProps> = ({ value, style }) => {
  const safeStyle = style || {};
  const counterStyle: React.CSSProperties = {
    fontSize: typeof safeStyle.fontSize === "number" ? `${safeStyle.fontSize}px` : "128px",
    lineHeight: 1,
    fontWeight: "700", // font-bold
    fontFamily: safeStyle.fontFamily,
    color: safeStyle.color || "#ffffff",
    backgroundColor: safeStyle.backgroundColor,
    borderRadius: typeof safeStyle.radius === "number" ? `${safeStyle.radius}px` : undefined,
    padding: typeof safeStyle.padding === "number" ? `${safeStyle.padding}px` : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  return <div style={counterStyle}>{value}</div>;
};

export default Counter;
