import React from "react";
import Title from "./Title";
import Counter from "./Counter";

// Define a comprehensive style interface
export interface OverlayStyle {
  arrangement?: "column" | "row" | "column-reverse" | "row-reverse";
  distance?: string;
  backgroundColor?: string;
  padding?: string;
  radius?: string;
  title?: {
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    startEmoji?: string;
    endEmoji?: string;
  };
  counter?: {
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    radius?: string;
    padding?: string;
  };
}

interface DisplayCounterProps {
  title: string;
  counter: number;
  style?: OverlayStyle;
}

const DisplayCounter: React.FC<DisplayCounterProps> = ({ title, counter, style = {} }) => {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: style.arrangement || "column",
    alignItems: "center",
    justifyContent: "center",
    gap: style.distance || "1rem", // Corresponds to mb-4
    backgroundColor: style.backgroundColor,
    padding: style.padding,
    borderRadius: style.radius,
  };

  const titleStyle = style.title || {};
  const counterStyle = style.counter || {};

  return (
    <div style={containerStyle}>
      <Title text={title} style={titleStyle} />
      <Counter value={counter} style={counterStyle} />
    </div>
  );
};

export default DisplayCounter;
