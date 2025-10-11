import React from "react";
import Title from "./Title";
import Counter from "./Counter";

// Define a comprehensive style interface
export interface OverlayStyle {
  arrangement?: "column" | "row" | "column-reverse" | "row-reverse";
  distance?: number;
  backgroundColor?: string;
  padding?: number;
  radius?: number;
  title?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    startEmoji?: string;
    endEmoji?: string;
  };
  counter?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    radius?: number;
    padding?: number;
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
    width: "100%",
    height: "100%",
    gap: style.distance ? `${style.distance}px` : "16px",
    backgroundColor: style.backgroundColor,
    padding: style.padding ? `${style.padding}px` : undefined,
    borderRadius: style.radius ? `${style.radius}px` : undefined,
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
