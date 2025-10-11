import React from "react";
import type { BaseElementStyle, CounterStyle, PrismaElement, GroupStyle } from "@/lib/types";
import Title from "./Title";
import Counter from "./Counter";

interface ElementDisplayProps {
  element: PrismaElement;
}

const ElementDisplay: React.FC<ElementDisplayProps> = ({ element }) => {
  const { type, style, title, counter } = element;

  const renderElement = () => {
    switch (type) {
      case "TITLE":
        return title ? <Title text={title.text} style={style as BaseElementStyle} /> : null;
      case "COUNTER":
        return counter ? <Counter value={counter.value} style={style as CounterStyle} /> : null;
      case "GROUP":
        return <GroupElement group={element} />;
      default:
        return null;
    }
  };

  return <>{renderElement()}</>;
};

const GroupElement: React.FC<{ group: PrismaElement }> = ({ group }) => {
  const { style, children } = group;
  const groupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: (style as GroupStyle)?.flexDirection || "column",
    gap: `${(style as GroupStyle)?.gap || 0}px`,
    justifyContent: (style as GroupStyle)?.justifyContent || "flex-start",
    alignItems: (style as GroupStyle)?.alignItems || "stretch",
    backgroundColor: (style as GroupStyle)?.backgroundColor,
    padding: (style as GroupStyle)?.padding ? `${(style as GroupStyle).padding}px` : undefined,
    borderRadius: (style as GroupStyle)?.radius ? `${(style as GroupStyle).radius}px` : undefined,
    width: "100%", // Groups should probably take full width of their container
  };

  return (
    <div style={groupStyle}>
      {children?.map((element) => (
        <ElementDisplay key={element.id} element={element} />
      ))}
    </div>
  );
};

export default ElementDisplay;
