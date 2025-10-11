import React from "react";

// Define a more specific type for title styles
interface TitleStyle {
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  startEmoji?: string;
  endEmoji?: string;
}

interface TitleProps {
  text: string;
  style: TitleStyle;
}

const Title: React.FC<TitleProps> = ({ text, style }) => {
  const titleStyle = {
    fontSize: style.fontSize || "2.25rem", // text-4xl
    lineHeight: "2.5rem",
    fontWeight: "700", // font-bold
    fontFamily: style.fontFamily,
    color: style.color || "#ffffff",
  };

  return (
    <h1 style={titleStyle}>
      {style.startEmoji && <span className="mr-2">{style.startEmoji}</span>}
      {text}
      {style.endEmoji && <span className="ml-2">{style.endEmoji}</span>}
    </h1>
  );
};

export default Title;
