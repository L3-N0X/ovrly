import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
  type OnOverlayChange,
} from "@/lib/types";
import { BingoEditor } from "../BingoEditor";
import type { BingoDataUpdate } from "@/lib/bingo";
import { ContainerEditor } from "../ContainerEditor";
import { CounterStyleEditor } from "../CounterEditor";
import { GroupEditor, GroupPositionEditor } from "../GroupEditor";
import { IconStyleEditor } from "../IconEditor";
import ImageStyleEditor from "../ImageStyleEditor";
import { ProgressEditor } from "../ProgressEditor";
import { RectangleEditor } from "../RectangleEditor";
import { TimerStyleEditor } from "../TimerEditor";
import { TitleStyleEditor } from "../TitleEditor";

// Updates the selected element's style. onOverlayChange persists it itself (debounced per
// element).
const styleUpdater =
  (element: PrismaElement, overlay: PrismaOverlay, onOverlayChange: OnOverlayChange) =>
  (newStyle: ElementStyle) =>
    onOverlayChange({
      ...overlay,
      elements: overlay.elements.map((el) =>
        el.id === element.id ? { ...el, style: newStyle } : el
      ),
    });

// X/Y of an element inside a group.
export const ElementPositionEditor = ({
  element,
  overlay,
  onOverlayChange,
}: {
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
}) => {
  const updateStyle = styleUpdater(element, overlay, onOverlayChange);
  return (
    <GroupPositionEditor
      element={element}
      onChange={(position) => updateStyle({ ...(element.style || {}), ...position })}
    />
  );
};

// The appearance settings of the selected element.
export const ElementStyleEditor = ({
  element,
  overlay,
  onOverlayChange,
  onBingoDataChange,
}: {
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  onBingoDataChange?: (elementId: string, data: BingoDataUpdate) => void;
}) => {
  const updateStyle = styleUpdater(element, overlay, onOverlayChange);
  const editorProps = { element, onChange: updateStyle };

  switch (element.type) {
    case ElementTypeEnum.TITLE:
      return <TitleStyleEditor {...editorProps} />;
    case ElementTypeEnum.COUNTER:
      return <CounterStyleEditor {...editorProps} />;
    case ElementTypeEnum.TIMER:
    case ElementTypeEnum.COUNTDOWN:
      return <TimerStyleEditor {...editorProps} />;
    case ElementTypeEnum.ICON:
      return <IconStyleEditor {...editorProps} />;
    case ElementTypeEnum.IMAGE:
      return <ImageStyleEditor {...editorProps} />;
    case ElementTypeEnum.BINGO:
      return <BingoEditor {...editorProps} onDataChange={onBingoDataChange} />;
    case ElementTypeEnum.CONTAINER:
      return <ContainerEditor {...editorProps} />;
    case ElementTypeEnum.GROUP:
      return <GroupEditor {...editorProps} />;
    case ElementTypeEnum.RECTANGLE:
      return <RectangleEditor {...editorProps} />;
    case ElementTypeEnum.PROGRESS:
      return <ProgressEditor {...editorProps} />;
  }
};
