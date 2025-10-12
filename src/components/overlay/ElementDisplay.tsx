import React from "react";
import type { BaseElementStyle, CounterStyle, PrismaElement } from "@/lib/types";
import Title from "./Title";
import Counter from "./Counter";
import Container, { type ContainerStyle } from "./Container";

interface ElementDisplayProps {
  element: PrismaElement;
}

const ElementDisplay: React.FC<ElementDisplayProps> = ({ element }) => {
  const { type, style, title, counter, children } = element;

  const renderElement = () => {
    switch (type) {
      case "TITLE":
        return title ? <Title text={title.text} style={(style || {}) as BaseElementStyle} /> : null;
      case "COUNTER":
        return counter ? (
          <Counter value={counter.value} style={(style || {}) as CounterStyle} />
        ) : null;
      case "CONTAINER":
        return (
          <Container style={(style || {}) as ContainerStyle}>
            {children?.map((element) => (
              <ElementDisplay key={element.id} element={element} />
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