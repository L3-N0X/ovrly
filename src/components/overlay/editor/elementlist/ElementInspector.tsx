import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
  type OnOverlayChange
} from "@/lib/types";
import { BingoEditor } from "../BingoEditor";
import type { BingoDataUpdate } from "@/lib/bingo";
import { ContainerEditor } from "../ContainerEditor";
import { CounterStyleEditor } from "../CounterEditor";
import { GroupEditor, GroupPositionEditor } from "../GroupEditor";
import ImageStyleEditor from "../ImageStyleEditor";
import { TimerStyleEditor } from "../TimerEditor";
import { TitleStyleEditor } from "../TitleEditor";

// The settings of the element selected in the tree.
export const ElementInspector = ({
  element,
  overlay,
  onOverlayChange,
  onBingoDataChange,
  onDelete,
}: {
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  onBingoDataChange?: (elementId: string, data: BingoDataUpdate) => void;
  onDelete: () => void;
}) => {
  const isInGroup =
    overlay.elements.find((e) => e.id === element.parentId)?.type === ElementTypeEnum.GROUP;

  // onOverlayChange persists the style change itself (debounced per element).
  const updateStyle = (newStyle: ElementStyle) => {
    onOverlayChange({
      ...overlay,
      elements: overlay.elements.map((el) =>
        el.id === element.id ? { ...el, style: newStyle } : el
      ),
    });
  };

  const editorProps = { element, onOverlayChange, onChange: updateStyle, onDelete };

  return (
    // Keyed so local editor state (sliders, pickers) doesn't leak between elements.
    <div key={element.id} className="animate-fadeIn">
      {isInGroup && (
        <GroupPositionEditor
          element={element}
          onChange={(position) => updateStyle({ ...(element.style || {}), ...position })}
        />
      )}
      {element.type === ElementTypeEnum.TITLE && <TitleStyleEditor {...editorProps} />}
      {element.type === ElementTypeEnum.COUNTER && <CounterStyleEditor {...editorProps} />}
      {element.type === ElementTypeEnum.TIMER && <TimerStyleEditor {...editorProps} />}
      {element.type === ElementTypeEnum.IMAGE && <ImageStyleEditor {...editorProps} />}
      {element.type === ElementTypeEnum.BINGO && (
        <BingoEditor {...editorProps} onDataChange={onBingoDataChange} />
      )}
      {element.type === ElementTypeEnum.CONTAINER && <ContainerEditor {...editorProps} />}
      {element.type === ElementTypeEnum.GROUP && <GroupEditor {...editorProps} />}
    </div>
  );
};
