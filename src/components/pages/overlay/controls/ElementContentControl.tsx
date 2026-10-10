import React from "react";
import {
  ElementTypeEnum,
  type IconLibrary,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import type { BingoDataUpdate } from "@/lib/bingo";
import type { CountdownAction } from "@/lib/countdown";
import type { CycleStackAction } from "@/lib/cycleStack";
import type { SubathonAction, SubathonSettings } from "@/lib/subathon";
import TimerControl from "./TimerControl";
import CountdownControl from "./CountdownControl";
import SubathonControl from "./SubathonControl";
import CounterControl from "./CounterControl";
import TitleControl from "./TitleControl";
import IconControl from "./IconControl";
import ImageControl from "./ImageControl";
import BingoControl from "./BingoControl";
import CycleStackControl from "./CycleStackControl";
import ProgressControl, { type ProgressChange } from "./ProgressControl";

// Everything that changes what an element shows (as opposed to how it looks).
export interface ContentHandlers {
  onCounterChange: (elementId: string, value: number) => void;
  onCounterIncrement: (elementId: string, increment: number) => void;
  onTitleChange: (elementId: string, text: string) => void;
  onImageChange: (elementId: string, src: string) => void;
  onIconChange: (elementId: string, icon: { library: IconLibrary; name: string }) => void;
  onBingoDataChange: (elementId: string, data: BingoDataUpdate) => void;
  onProgressChange: (elementId: string, change: ProgressChange) => void;
  onTimerToggle: (elementId: string) => void;
  onTimerReset: (elementId: string) => void;
  onTimerAddTime: (elementId: string, timeToAdd: number) => void;
  onCountdownAction: (elementId: string, action: CountdownAction) => void;
  onSubathonAction: (elementId: string, action: SubathonAction) => void;
  onCycleStackAction: (elementId: string, action: CycleStackAction) => void;
  // Not content but design (editors only); here so the inspector gets it with the rest.
  onSubathonSettings: (elementId: string, settings: SubathonSettings) => void;
}

export const ElementContentControl: React.FC<{
  element: PrismaElement;
  // The overlay it is in, for elements whose content is other elements (cycle stacks).
  overlay: PrismaOverlay;
  handlers: ContentHandlers;
}> = ({ element, overlay, handlers }) => {
  switch (element.type) {
    case ElementTypeEnum.TIMER:
      return (
        <TimerControl
          element={element}
          handleTimerToggle={handlers.onTimerToggle}
          handleTimerReset={handlers.onTimerReset}
          handleTimerAddTime={handlers.onTimerAddTime}
        />
      );
    case ElementTypeEnum.COUNTDOWN:
      return <CountdownControl element={element} onAction={handlers.onCountdownAction} />;
    case ElementTypeEnum.SUBATHON:
      return <SubathonControl element={element} onAction={handlers.onSubathonAction} />;
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
    case ElementTypeEnum.ICON:
      return <IconControl element={element} onIconChange={handlers.onIconChange} />;
    case ElementTypeEnum.PROGRESS:
      return <ProgressControl element={element} onProgressChange={handlers.onProgressChange} />;
    case ElementTypeEnum.BINGO:
      return <BingoControl element={element} onDataChange={handlers.onBingoDataChange} />;
    case ElementTypeEnum.CYCLE_STACK:
      return (
        <CycleStackControl
          element={element}
          overlay={overlay}
          onAction={handlers.onCycleStackAction}
        />
      );
    default:
      return null;
  }
};
