import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import {
  ElementTypeEnum,
  isElementVisible,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
  type OnOverlayChange,
} from "@/lib/types";
import { BingoEditor } from "../BingoEditor";
import { ChatEditor } from "../ChatEditor";
import type { BingoDataUpdate } from "@/lib/bingo";
import { ContainerEditor } from "../ContainerEditor";
import { CounterStyleEditor } from "../CounterEditor";
import { CycleStackEditor } from "../CycleStackEditor";
import { FieldHint, InspectorSection } from "../fields";
import { GroupEditor, PositionFields } from "../GroupEditor";
import { IconStyleEditor } from "../IconEditor";
import ImageStyleEditor from "../ImageStyleEditor";
import { ProgressEditor } from "../ProgressEditor";
import { RectangleEditor } from "../RectangleEditor";
import { ScrollerEditor } from "../ScrollerEditor";
import { SubathonStyleEditor } from "../SubathonEditor";
import { TimerStyleEditor } from "../TimerEditor";
import { TitleStyleEditor } from "../TitleEditor";
import VideoStyleEditor from "../VideoStyleEditor";
import { isPlacedFreely } from "./tree";

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

// Where the element sits. Always the first section, so it is found in the same place for every
// element: X/Y for elements placed freely (in a group or on a free canvas), otherwise a note
// that their parent lays them out.
export const ElementPositionSection = ({
  element,
  overlay,
  onOverlayChange,
}: {
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
}) => {
  const updateStyle = styleUpdater(element, overlay, onOverlayChange);
  const parent = element.parentId
    ? overlay.elements.find((candidate) => candidate.id === element.parentId)
    : undefined;
  return (
    <InspectorSection title="Position">
      {isPlacedFreely(overlay, element) ? (
        <PositionFields
          element={element}
          onChange={(position) => updateStyle({ ...(element.style || {}), ...position })}
        />
      ) : (
        <FieldHint>
          Placed by the auto layout of{" "}
          {parent ? <strong className="font-medium">{parent.name}</strong> : "the canvas"}. Its
          order is changed in the layers panel.
        </FieldHint>
      )}
    </InspectorSection>
  );
};

// Whether the element is drawn. Bound to a yes/no variable, apps and providers can show and hide it.
export const ElementVisibilitySection = ({
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
    <InspectorSection title="Visibility">
      <BindableField
        property="style.visible"
        inline
        htmlFor={`${element.id}-visible`}
        label="Visible"
      >
        <Switch
          id={`${element.id}-visible`}
          checked={isElementVisible(element)}
          onCheckedChange={(visible) => updateStyle({ ...(element.style || {}), visible })}
        />
      </BindableField>
    </InspectorSection>
  );
};

// The design sections of the selected element (Layout, Appearance, Text, Fill, Stroke, Effects
// and its own), each editor rendering them in that order.
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
    case ElementTypeEnum.SUBATHON:
      return <SubathonStyleEditor {...editorProps} />;
    case ElementTypeEnum.ICON:
      return <IconStyleEditor {...editorProps} />;
    case ElementTypeEnum.IMAGE:
      return <ImageStyleEditor {...editorProps} />;
    case ElementTypeEnum.VIDEO:
      return <VideoStyleEditor {...editorProps} />;
    case ElementTypeEnum.BINGO:
      return <BingoEditor {...editorProps} onDataChange={onBingoDataChange} />;
    case ElementTypeEnum.CONTAINER:
      return <ContainerEditor {...editorProps} />;
    case ElementTypeEnum.GROUP:
      return <GroupEditor {...editorProps} />;
    case ElementTypeEnum.RECTANGLE:
      return <RectangleEditor {...editorProps} />;
    case ElementTypeEnum.SCROLLER:
      return <ScrollerEditor {...editorProps} />;
    case ElementTypeEnum.CYCLE_STACK:
      return <CycleStackEditor {...editorProps} />;
    case ElementTypeEnum.PROGRESS:
      return <ProgressEditor {...editorProps} />;
    case ElementTypeEnum.CHAT:
      return <ChatEditor {...editorProps} />;
  }
};
