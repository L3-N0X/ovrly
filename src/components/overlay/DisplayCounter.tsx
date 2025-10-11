import React from "react";
import FontLoader from "@/components/FontLoader";
import Title from "./Title";
import Counter from "./Counter";

// Define a comprehensive style interface
export interface OverlayStyle {
  arrangement?: "column" | "row" | "column-reverse" | "row-reverse";
  distance?: number;
  backgroundColor?: string;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  verticalAlignment?: "top" | "center" | "bottom";
  horizontalAlignment?: "left" | "center" | "right";
  verticalAlign?: "center" | "baseline";
  title?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
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
  const {
    verticalAlignment = "center",
    horizontalAlignment = "center",
    verticalAlign = "center",
    arrangement = "column",
    distance = 16,
  } = style;

  const outerStyle: React.CSSProperties = {
    display: "flex",
    width: "800px",
    height: "600px",
    justifyContent:
      horizontalAlignment === "left"
        ? "flex-start"
        : horizontalAlignment === "right"
        ? "flex-end"
        : "center",
    alignItems:
      verticalAlignment === "top"
        ? "flex-start"
        : verticalAlignment === "bottom"
        ? "flex-end"
        : "center",
    backgroundColor: style.backgroundColor,
    padding: style.padding
      ? `${style.padding}px`
      : style.paddingX !== undefined || style.paddingY !== undefined
      ? `${style.paddingY || 0}px ${style.paddingX || 0}px`
      : undefined,
    borderRadius: style.radius ? `${style.radius}px` : undefined,
  };

  const innerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: arrangement,
    alignItems: verticalAlign,
    gap: `${distance}px`,
  };

  const titleStyle = { ...style.title };
  const counterStyle = { ...style.counter };

  return (
    <div style={outerStyle}>
      <FontLoader fontFamily={titleStyle.fontFamily} />
      <FontLoader fontFamily={counterStyle.fontFamily} />
      <div style={innerStyle}>
        <Title text={title} style={titleStyle} />
        <Counter value={counter} style={counterStyle} />
      </div>
    </div>
  );
};

export default DisplayCounter;
