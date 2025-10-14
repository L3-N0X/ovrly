import React from "react";
import type { BaseElementStyle, CounterStyle, PrismaElement, ContainerStyle, TimerStyle } from "@/lib/types";
import Title from "./Title";
import Counter from "./Counter";
import Container from "./Container";
import Timer from "./Timer";

interface ElementDisplayProps {
  element: PrismaElement;
  elements: PrismaElement[];
}

const ElementDisplay: React.FC<ElementDisplayProps> = ({ element, elements }) => {
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
          <Timer startedAt={timer.startedAt ? new Date(timer.startedAt) : null} pausedAt={timer.pausedAt ? new Date(timer.pausedAt) : null} style={(style || {}) as TimerStyle} />
        ) : null;
      case "CONTAINER":
        return (
          <Container style={(style || {}) as ContainerStyle}>
            {children.map((child) => (
              <ElementDisplay key={child.id} element={child} elements={elements} />
            ))}
          </Container>
        );
      default:
        return null;
    }
  };

  return <>{renderElement()}</>;
};

export default ElementDisplay;
