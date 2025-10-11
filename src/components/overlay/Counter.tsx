import React from "react";

// Define a more specific type for counter styles
interface CounterStyle {
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  radius?: string;
  padding?: string;
}

interface CounterProps {
  value: number;
  style: CounterStyle;
}

const Counter: React.FC<CounterProps> = ({ value, style }) => {
  const counterStyle = {
    fontSize: style.fontSize || "8rem", // text-9xl
    fontWeight: "700", // font-bold
    fontFamily: style.fontFamily,
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderRadius: style.radius,
    padding: style.padding,
  };

  return <div style={counterStyle}>{value}</div>;
};

export default Counter;
