import React, { useState } from "react";
import { Monitor, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasEditor } from "@/components/overlay/editor/CanvasEditor";
import { GlobalStyleEditor } from "@/components/overlay/editor/GlobalStyleEditor";
import { renameElement } from "@/components/overlay/editor/renameElement";
import { InlineRename } from "@/components/ui/inline-rename";
import {
  ElementPositionSection,
  ElementStyleEditor,
} from "@/components/overlay/editor/elementlist/ElementInspector";
import { InspectorSection } from "@/components/overlay/editor/fields";
import { ElementTypeIcon } from "@/components/overlay/editor/elementlist/ElementTypeIcon";
import { flattenTree } from "@/components/overlay/editor/elementlist/tree";
import {
  canvasSize,
  CanvasModeEnum,
  hasContent,
  type OnOverlayChange,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import { BindingElementContext } from "@/lib/variablesContext";
import { ElementContentControl, type ContentHandlers } from "./controls/ElementContentControl";
import { OVERLAY_SELECTION, type EditorSelection } from "./editorSelection";

interface InspectorProps {
  overlay: PrismaOverlay;
  selectedId: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onOverlayChange: OnOverlayChange;
  // Asks for confirmation before deleting the element (and everything inside it).
  onRequestDelete: (elementId: string) => void;
  content: ContentHandlers;
}

// The right hand panel, laid out like Figma's. What it shows follows the selection: an element's
// content followed by its design in sections of a fixed order (Position, Layout, Appearance,
// Text, Fill, Stroke, Effects); the canvas and its layout; or, with nothing selected, the content
// controls of every element so the overlay can be run live from one place.
const Inspector: React.FC<InspectorProps> = ({
  overlay,
  selectedId,
  onSelect,
  onOverlayChange,
  onRequestDelete,
  content,
}) => {
  if (selectedId === OVERLAY_SELECTION) {
    const { width, height } = canvasSize(overlay);
    return (
      <>
        <PanelHeader>
          <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">Canvas</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {width} × {height}
          </span>
        </PanelHeader>
        <CanvasEditor overlay={overlay} onOverlayChange={onOverlayChange} />
        {/* The arrangement only places what sits directly on the canvas, so it is only shown
            when the canvas arranges those elements. */}
        {overlay.canvasMode === CanvasModeEnum.AUTO && (
          <GlobalStyleEditor overlay={overlay} onOverlayChange={onOverlayChange} />
        )}
      </>
    );
  }

  const selected = overlay.elements.find((e) => e.id === selectedId);
  if (selected) {
    return (
      <ElementPanel
        // Keyed so local editor state (sliders, pickers) doesn't leak between elements.
        key={selected.id}
        element={selected}
        overlay={overlay}
        onOverlayChange={onOverlayChange}
        onRequestDelete={onRequestDelete}
        content={content}
      />
    );
  }

  // Same order as the layers panel.
  const contentElements = flattenTree(overlay.elements, new Set())
    .map((row) => row.element)
    .filter((element) => hasContent(element.type));

  return (
    <>
      <PanelHeader>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Content
        </span>
      </PanelHeader>
      {contentElements.length === 0 ? (
        <p className="px-3 py-6 text-xs text-muted-foreground">
          No elements with content yet. Add a title, counter, timer, image, icon or bingo card in the
          layers panel.
        </p>
      ) : (
        contentElements.map((element) => (
          <section key={element.id} className="space-y-2 border-b px-3 py-3">
            <button
              type="button"
              title="Select to edit style and position"
              onClick={() => onSelect(element.id)}
              className="flex max-w-full cursor-pointer items-center gap-1.5 text-sm font-medium hover:text-primary"
            >
              <ElementTypeIcon element={element} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{element.name}</span>
            </button>
            <BindingElementContext.Provider value={element}>
              <ElementContentControl element={element} handlers={content} />
            </BindingElementContext.Provider>
          </section>
        ))
      )}
      <p className="px-3 py-3 text-xs text-muted-foreground">
        Select an element on the canvas or in the layers panel to change its style and position.
      </p>
    </>
  );
};

const ElementPanel = ({
  element,
  overlay,
  onOverlayChange,
  onRequestDelete,
  content,
}: Omit<InspectorProps, "selectedId" | "onSelect"> & { element: PrismaElement }) => {
  // The element whose name is being edited, so selecting another one ends it.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const isRenaming = renamingId === element.id;

  return (
    <BindingElementContext.Provider value={element}>
      <PanelHeader>
        <ElementTypeIcon element={element} className="h-4 w-4 shrink-0 text-muted-foreground" />
        {isRenaming ? (
          <InlineRename
            value={element.name}
            aria-label="Element name"
            onDone={(name) => {
              setRenamingId(null);
              if (name) renameElement(element.id, element.name, name, onOverlayChange);
            }}
          />
        ) : (
          <>
            <span
              className="cursor-text truncate text-sm font-semibold"
              title="Double-click to rename"
              onDoubleClick={() => setRenamingId(element.id)}
            >
              {element.name}
            </span>
            <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
              {element.type}
            </span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          {!isRenaming && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Rename"
              aria-label="Rename element"
              onClick={() => setRenamingId(element.id)}
            >
              <Pencil />
            </Button>
          )}
          <Button
            variant="destructiveGhost"
            size="icon-sm"
            title="Delete (Del)"
            aria-label="Delete element"
            onClick={() => onRequestDelete(element.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </PanelHeader>
      {hasContent(element.type) && (
        <InspectorSection title="Content">
          <ElementContentControl element={element} handlers={content} />
        </InspectorSection>
      )}
      <ElementPositionSection
        element={element}
        overlay={overlay}
        onOverlayChange={onOverlayChange}
      />
      <ElementStyleEditor
        element={element}
        overlay={overlay}
        onOverlayChange={onOverlayChange}
        onBingoDataChange={content.onBingoDataChange}
      />
    </BindingElementContext.Provider>
  );
};

const PanelHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="sticky top-0 z-10 flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3">
    {children}
  </div>
);

export default Inspector;
