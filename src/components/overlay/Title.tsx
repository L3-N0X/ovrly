import React from "react";

// Define a more specific type for title styles
interface TitleStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

interface TitleProps {
  text: string;
  style: TitleStyle;
}

const Title: React.FC<TitleProps> = ({ text, style }) => {
  const titleStyle: React.CSSProperties = {
    fontSize: style.fontSize ? `${style.fontSize}px` : "36px",
    lineHeight: 1,
    fontWeight: "700", // font-bold
    fontFamily: style.fontFamily,
    color: style.color || "#ffffff",
    whiteSpace: "nowrap",
  };

  return <h1 style={titleStyle}>{text}</h1>;
};

export default Title;
