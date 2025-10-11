import React from "react";

// Define a more specific type for counter styles
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
  const counterStyle: React.CSSProperties = {
    fontSize: style.fontSize ? `${style.fontSize}px` : "128px",
    lineHeight: 1,
    fontWeight: "700", // font-bold
    fontFamily: style.fontFamily,
    color: style.color || "#ffffff",
    backgroundColor: style.backgroundColor,
    borderRadius: style.radius ? `${style.radius}px` : undefined,
    padding: style.padding ? `${style.padding}px` : undefined,
  };

  return <div style={counterStyle}>{value}</div>;
};

export default Counter;
