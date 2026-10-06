import React from "react";
import { Monitor, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalStyleEditor } from "@/components/overlay/editor/GlobalStyleEditor";
import { RenameElementModal } from "@/components/overlay/editor/RenameElementModal";
import {
  ElementPositionEditor,
  ElementStyleEditor,
} from "@/components/overlay/editor/elementlist/ElementInspector";
import type { OnStructureChange } from "@/components/overlay/editor/elementlist/ElementListEditor";
import { ElementTypeIcon } from "@/components/overlay/editor/elementlist/ElementTypeIcon";
import { flattenTree, isInGroup } from "@/components/overlay/editor/elementlist/tree";
import { cn } from "@/lib/utils";
import {
  hasContent,
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  type OnOverlayChange,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import { ElementContentControl, type ContentHandlers } from "./controls/ElementContentControl";
import { OVERLAY_SELECTION, type EditorSelection } from "./editorSelection";

interface InspectorProps {
  overlay: PrismaOverlay;
  selectedId: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onOverlayChange: OnOverlayChange;
  onStructureChange: OnStructureChange;
  content: ContentHandlers;
}

// The right hand panel. What it shows follows the selection: an element's content, position
// and style; the overlay's global layout; or, with nothing selected, the content controls of
// every element so the overlay can be run live from one place.
const Inspector: React.FC<InspectorProps> = ({
  overlay,
  selectedId,
  onSelect,
  onOverlayChange,
  onStructureChange,
  content,
}) => {
  if (selectedId === OVERLAY_SELECTION) {
    return (
      <>
        <PanelHeader>
          <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">Canvas</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {OVERLAY_WIDTH} × {OVERLAY_HEIGHT}
          </span>
        </PanelHeader>
        <PanelSection title="Layout">
          <GlobalStyleEditor overlay={overlay} onOverlayChange={onOverlayChange} />
        </PanelSection>
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
        onSelect={onSelect}
        onOverlayChange={onOverlayChange}
        onStructureChange={onStructureChange}
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
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No elements with content yet. Add a title, counter, timer, image or bingo card in the
          layers panel.
        </p>
      ) : (
        contentElements.map((element) => (
          <section key={element.id} className="space-y-2 border-b px-4 py-3">
            <button
              type="button"
              title="Select to edit style and position"
              onClick={() => onSelect(element.id)}
              className="flex max-w-full cursor-pointer items-center gap-1.5 text-sm font-medium hover:text-primary"
            >
              <ElementTypeIcon element={element} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{element.name}</span>
            </button>
            <ElementContentControl element={element} handlers={content} />
          </section>
        ))
      )}
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Select an element on the canvas or in the layers panel to change its style and position.
      </p>
    </>
  );
};

const ElementPanel = ({
  element,
  overlay,
  onSelect,
  onOverlayChange,
  onStructureChange,
  content,
}: Omit<InspectorProps, "selectedId"> & { element: PrismaElement }) => {
  // Deletes the element together with everything nested inside it.
  const deleteElement = () => {
    const findChildren = (parentId: string): string[] =>
      overlay.elements
        .filter((e) => e.parentId === parentId)
        .flatMap((child) => [child.id, ...findChildren(child.id)]);
    const ids = [element.id, ...findChildren(element.id)];

    onSelect(null);
    onStructureChange(
      (current) => ({ ...current, elements: current.elements.filter((e) => !ids.includes(e.id)) }),
      `delete:${element.id}`,
      { url: "/api/elements/delete", method: "DELETE", body: { ids } }
    );
  };

  return (
    <>
      <PanelHeader>
        <ElementTypeIcon element={element} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-semibold">{element.name}</span>
        <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
          {element.type}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <RenameElementModal element={element} onOverlayChange={onOverlayChange}>
            <Button variant="ghost" size="icon-sm" title="Rename" aria-label="Rename element">
              <Pencil />
            </Button>
          </RenameElementModal>
          <Button
            variant="destructiveGhost"
            size="icon-sm"
            title="Delete"
            aria-label="Delete element"
            onClick={deleteElement}
          >
            <Trash2 />
          </Button>
        </div>
      </PanelHeader>
      {hasContent(element.type) && (
        <PanelSection title="Content">
          <ElementContentControl element={element} handlers={content} />
        </PanelSection>
      )}
      {isInGroup(overlay.elements, element) && (
        <PanelSection title="Position">
          <ElementPositionEditor
            element={element}
            overlay={overlay}
            onOverlayChange={onOverlayChange}
          />
        </PanelSection>
      )}
      <PanelSection title="Style">
        <ElementStyleEditor
          element={element}
          overlay={overlay}
          onOverlayChange={onOverlayChange}
          onBingoDataChange={content.onBingoDataChange}
        />
      </PanelSection>
    </>
  );
};

const PanelHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b bg-background px-4">
    {children}
  </div>
);

const PanelSection = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={cn("space-y-3 border-b px-4 py-4", className)}>
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {title}
    </h3>
    {children}
  </section>
);

export default Inspector;
