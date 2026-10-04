import React from "react";
import type { BaseElementStyle, CounterStyle, PrismaElement, ContainerStyle, TimerStyle } from "@/lib/types";
import Title from "./Title";
import Counter from "./Counter";
import Container from "./Container";
import Timer from "./Timer";
import Image from "./Image";
import Bingo from "./Bingo";

interface ElementDisplayProps {
  element: PrismaElement;
  elements: PrismaElement[];
  isEditor?: boolean;
}

const ElementDisplay: React.FC<ElementDisplayProps> = ({ element, elements, isEditor = false }) => {
  const { type, style, title, counter, timer } = element;

  const children = elements
    .filter((e) => e.parentId === element.id)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const renderElement = () => {
    switch (type) {
      case "TITLE":
        return title ? <Title text={title.text} style={(style || {}) as BaseElementStyle} /> : null;
      case "COUNTER":
        return counter ? (
          <Counter value={counter.value} style={(style || {}) as CounterStyle} />
        ) : null;
      case "TIMER":
        return timer ? (
          <Timer startedAt={timer.startedAt ? new Date(timer.startedAt) : null} pausedAt={timer.pausedAt ? new Date(timer.pausedAt) : null} duration={timer.duration} countDown={timer.countDown} style={(style || {}) as TimerStyle} />
        ) : null;
      case "CONTAINER":
        return (
          <Container style={(style || {}) as ContainerStyle}>
            {children.map((child) => (
              <ElementDisplay
                key={child.id}
                element={child}
                elements={elements}
                isEditor={isEditor}
              />
            ))}
          </Container>
        );
      case "IMAGE":
        return <Image element={element} />;
      case "BINGO":
        return <Bingo element={element} isEditor={isEditor} />;
      default:
        return null;
    }
  };

  return <>{renderElement()}</>;
};

export default ElementDisplay;
