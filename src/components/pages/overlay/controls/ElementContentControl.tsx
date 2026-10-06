import React from "react";
import { ElementTypeEnum, type PrismaElement } from "@/lib/types";
import type { BingoDataUpdate } from "@/lib/bingo";
import TimerControl from "./TimerControl";
import CounterControl from "./CounterControl";
import TitleControl from "./TitleControl";
import ImageControl from "./ImageControl";
import BingoControl from "./BingoControl";

// Everything that changes what an element shows (as opposed to how it looks).
export interface ContentHandlers {
  onCounterChange: (elementId: string, value: number) => void;
  onCounterIncrement: (elementId: string, increment: number) => void;
  onTitleChange: (elementId: string, text: string) => void;
  onImageChange: (elementId: string, src: string) => void;
  onBingoDataChange: (elementId: string, data: BingoDataUpdate) => void;
  onTimerToggle: (elementId: string) => void;
  onTimerReset: (elementId: string) => void;
  onTimerUpdate: (elementId: string, update: { countDown: boolean }) => void;
  onTimerAddTime: (elementId: string, timeToAdd: number) => void;
}

export const ElementContentControl: React.FC<{
  element: PrismaElement;
  handlers: ContentHandlers;
}> = ({ element, handlers }) => {
  switch (element.type) {
    case ElementTypeEnum.TIMER:
      return (
        <TimerControl
          element={element}
          handleTimerToggle={handlers.onTimerToggle}
          handleTimerReset={handlers.onTimerReset}
          handleTimerUpdate={handlers.onTimerUpdate}
          handleTimerAddTime={handlers.onTimerAddTime}
        />
      );
    case ElementTypeEnum.COUNTER:
      return (
        <CounterControl
          element={element}
          handleCounterChange={handlers.onCounterChange}
          handleCounterIncrement={handlers.onCounterIncrement}
        />
      );
    case ElementTypeEnum.TITLE:
      return <TitleControl element={element} handleTitleChange={handlers.onTitleChange} />;
    case ElementTypeEnum.IMAGE:
      return <ImageControl element={element} handleImageChange={handlers.onImageChange} />;
    case ElementTypeEnum.BINGO:
      return <BingoControl element={element} onDataChange={handlers.onBingoDataChange} />;
    default:
      return null;
  }
};
