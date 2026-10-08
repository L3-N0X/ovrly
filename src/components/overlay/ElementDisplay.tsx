import React from "react";
import type {
  BaseElementStyle,
  CounterStyle,
  PrismaElement,
  ContainerStyle,
  IconStyle,
  TimerStyle,
} from "@/lib/types";
import Title from "./Title";
import Counter from "./Counter";
import Container from "./Container";
import Timer from "./Timer";
import Countdown from "./Countdown";
import Icon from "./Icon";
import Image from "./Image";
import Bingo from "./Bingo";
import Group from "./Group";
import { CANVAS_ELEMENT_ATTRIBUTE, useCanvasSelection } from "./canvasSelection";

interface ElementDisplayProps {
  element: PrismaElement;
  elements: PrismaElement[];
}

const ElementDisplay: React.FC<ElementDisplayProps> = ({ element, elements }) => {
  const { type, style, title, counter, timer, countdown, icon } = element;
  const selection = useCanvasSelection();

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
          <Timer
            startedAt={timer.startedAt ? new Date(timer.startedAt) : null}
            pausedAt={timer.pausedAt ? new Date(timer.pausedAt) : null}
            style={(style || {}) as TimerStyle}
          />
        ) : null;
      case "COUNTDOWN":
        return countdown ? (
          <Countdown countdown={countdown} style={(style || {}) as TimerStyle} />
        ) : null;
      case "CONTAINER":
        return (
          <Container element={element} style={(style || {}) as ContainerStyle}>
            {children.map((child) => (
              <ElementDisplay key={child.id} element={child} elements={elements} />
            ))}
          </Container>
        );
      case "ICON":
        return icon ? (
          <Icon icon={icon} style={(style || {}) as IconStyle} label={element.name} />
        ) : null;
      case "IMAGE":
        return <Image element={element} />;
      case "BINGO":
        // Only the editor preview provides a selection context; the public overlay is read only.
        return <Bingo element={element} isEditor={selection !== null} />;
      case "GROUP":
        return (
          <Group
            element={element}
            childElements={children}
            renderChild={(child) => <ElementDisplay element={child} elements={elements} />}
          />
        );
      default:
        return null;
    }
  };

  const content = renderElement();
  if (!selection || !content) return content;

  // `display: contents` keeps the wrapper out of the layout. The canvas finds the elements
  // under the pointer through it (see useCanvasGestures).
  return (
    <div {...{ [CANVAS_ELEMENT_ATTRIBUTE]: element.id }} style={{ display: "contents" }}>
      {content}
    </div>
  );
};

export default ElementDisplay;
