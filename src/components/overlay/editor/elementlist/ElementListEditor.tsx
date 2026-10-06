import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isParentType,
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  type OnOverlayChange,
  type OverlayChange,
  type PrismaOverlay,
} from "@/lib/types";
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { OVERLAY_SELECTION } from "@/components/pages/overlay/editorSelection";
import { ChevronsDownUp, ChevronsUpDown, Monitor } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddElementModal } from "../AddElementModal";
import { DropLine, ElementTreeItem, INDENT } from "./ElementTreeItem";
import {
  applyPlacement,
  childrenOf,
  flattenTree,
  isCurrentPlacement,
  resolveDrop,
  type DropTarget,
} from "./tree";

// Applies a move or delete locally and persists it with `request` (see useOverlayData).
export type OnStructureChange = (
  change: OverlayChange,
  key: string,
  request: { url: string; method: "POST" | "DELETE"; body: object }
) => void;

export interface ElementListEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  onStructureChange: OnStructureChange;
  // An element id, OVERLAY_SELECTION for the overlay itself, or null.
  selectedId: string | null;
  onSelect: (elementId: string | null) => void;
}

// The layers panel: the element tree with drag and drop, plus the overlay itself as root.
// Collapsed parents are remembered per overlay, so the tree looks the same after a reload.
const collapsedStorageKey = (overlayId: string) => `ovrly:collapsed:${overlayId}`;

const loadCollapsed = (overlayId: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(collapsedStorageKey(overlayId)) ?? "[]"));
  } catch {
    return new Set<string>();
  }
};

export const ElementListEditor: React.FC<ElementListEditorProps> = ({
  overlay,
  onOverlayChange,
  onStructureChange,
  selectedId,
  onSelect: setSelectedId,
}) => {
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(overlay.id));
  const [isDragging, setIsDragging] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey(overlay.id), JSON.stringify([...collapsed]));
  }, [overlay.id, collapsed]);

  const rows = useMemo(
    () => flattenTree(overlay.elements, collapsed),
    [overlay.elements, collapsed]
  );
  // Without a visible selected row, the first row takes the Tab stop so the tree stays
  // reachable from the keyboard.
  const tabbableId = rows.some((r) => r.element.id === selectedId)
    ? selectedId
    : (rows[0]?.element.id ?? null);

  // The drag handlers read these at event time instead of being re-registered on every
  // render (which would happen on every live update, mid-drag included).
  const latest = useRef({ overlay, onStructureChange });
  useEffect(() => {
    latest.current = { overlay, onStructureChange };
  });
  const getElements = useCallback(() => latest.current.overlay.elements, []);

  const setCollapsedFor = (id: string, value: boolean) =>
    setCollapsed((current) => {
      if (current.has(id) === value) return current;
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  // Open every collapsed ancestor so the selected row is visible in the tree.
  useEffect(() => {
    if (!selectedId) return;
    const ancestors = new Set<string>();
    for (
      let id = getElements().find((e) => e.id === selectedId)?.parentId;
      id;
      id = getElements().find((e) => e.id === id)?.parentId
    ) {
      ancestors.add(id);
    }
    setCollapsed((current) =>
      [...ancestors].some((id) => current.has(id))
        ? new Set([...current].filter((id) => !ancestors.has(id)))
        : current
    );
  }, [selectedId, getElements]);

  // Elements picked on the canvas may be far down a long tree, so their row is scrolled
  // into view. That has to wait until the effect above has opened its ancestors and the row
  // has rendered, and must happen only once: live updates re-render the rows all the time.
  const pendingReveal = useRef<string | null>(null);
  useEffect(() => {
    pendingReveal.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    const id = pendingReveal.current;
    const row = id && treeRef.current?.querySelector(`[data-tree-item-id="${CSS.escape(id)}"]`);
    if (!row) return;
    pendingReveal.current = null;
    row.scrollIntoView({ block: "nearest" });
  }, [selectedId, rows]);

  const parentIds = overlay.elements.filter((e) => isParentType(e.type)).map((e) => e.id);
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));

  useEffect(() => {
    return monitorForElements({
      onDragStart: () => setIsDragging(true),
      onDrop({ source, location }) {
        setIsDragging(false);
        const { overlay, onStructureChange } = latest.current;
        const target = location.current.dropTargets[0];
        if (!target) return;

        const sourceId = source.data.id as string;
        const instruction = extractInstruction(target.data);
        let dropTarget: DropTarget;
        if (instruction) {
          dropTarget = { kind: instruction.operation, id: target.data.id as string };
        } else if (target.data.appendTo !== undefined) {
          dropTarget = { kind: "append", parentId: target.data.appendTo as string | null };
        } else {
          return;
        }

        const placement = resolveDrop(overlay.elements, sourceId, dropTarget);
        if (!placement || isCurrentPlacement(overlay.elements, sourceId, placement)) return;

        const newElements = applyPlacement(overlay.elements, sourceId, placement);
        // Make sure the moved element stays visible
        if (placement.parentId) setCollapsedFor(placement.parentId, false);

        // Sends the complete layout, so a newer move can safely replace an older one that
        // hasn't been sent yet.
        onStructureChange({ ...overlay, elements: newElements }, "reorder", {
          url: "/api/elements/reorder",
          method: "POST",
          body: {
            elements: newElements.map(({ id, position, parentId }) => ({
              id,
              position,
              parentId: parentId ?? null,
            })),
            overlayId: overlay.id,
          },
        });
      },
    });
  }, []);

  const focusRow = (id: string) =>
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-tree-item-id="${CSS.escape(id)}"]`)
      ?.focus();

  // Arrow keys move through the visible rows, left/right close/open parents.
  const handleKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { element } = rows[index];
    const isParent = isParentType(element.type);
    const select = (id: string) => {
      setSelectedId(id);
      focusRow(id);
    };
    switch (e.key) {
      case "ArrowDown":
        if (rows[index + 1]) select(rows[index + 1].element.id);
        break;
      case "ArrowUp":
        if (rows[index - 1]) select(rows[index - 1].element.id);
        break;
      case "ArrowRight":
        if (isParent && collapsed.has(element.id)) setCollapsedFor(element.id, false);
        else if (isParent && rows[index + 1]?.element.parentId === element.id)
          select(rows[index + 1].element.id);
        break;
      case "ArrowLeft":
        if (isParent && !collapsed.has(element.id)) setCollapsedFor(element.id, true);
        else if (element.parentId) select(element.parentId);
        break;
      case "Enter":
      case " ":
        setSelectedId(selectedId === element.id ? null : element.id);
        break;
      case "Escape":
        setSelectedId(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const overlaySelected = selectedId === OVERLAY_SELECTION;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between gap-2 border-b bg-background px-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Layers
        </h2>
        <div className="flex items-center">
          {parentIds.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={allCollapsed ? "Expand all" : "Collapse all"}
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(parentIds))}
            >
              {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
            </Button>
          )}
          <AddElementModal
            overlay={overlay}
            onOverlayChange={onOverlayChange}
            onAdded={setSelectedId}
          />
        </div>
      </div>

      <div className="p-2">
        {/* The overlay itself; selecting it shows the global layout settings. */}
        <button
          type="button"
          aria-pressed={overlaySelected}
          onClick={() => setSelectedId(overlaySelected ? null : OVERLAY_SELECTION)}
          className={cn(
            "flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            overlaySelected ? "bg-primary/15 text-foreground" : "hover:bg-accent"
          )}
        >
          <Monitor className="ml-[22px] h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">Canvas</span>
          <span className="ml-auto shrink-0 pr-1 text-[10px] text-muted-foreground tabular-nums">
            {OVERLAY_WIDTH} × {OVERLAY_HEIGHT}
          </span>
        </button>
        <div className="mx-1 my-1 border-b" />

        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No elements yet. Add one with the + button.
          </p>
        ) : (
          <div ref={treeRef} role="tree" aria-label="Elements">
            {rows.map((row, index) => {
              const { element, depth } = row;
              const isOpenEmptyParent =
                isParentType(element.type) &&
                !collapsed.has(element.id) &&
                childrenOf(overlay.elements, element.id).length === 0;
              return (
                <React.Fragment key={element.id}>
                  <ElementTreeItem
                    row={row}
                    collapsed={collapsed.has(element.id)}
                    selected={element.id === selectedId}
                    tabbable={element.id === tabbableId}
                    getElements={getElements}
                    onSelect={() => setSelectedId(element.id === selectedId ? null : element.id)}
                    onToggleCollapsed={() =>
                      setCollapsedFor(element.id, !collapsed.has(element.id))
                    }
                    onExpand={() => setCollapsedFor(element.id, false)}
                    onKeyDown={handleKeyDown(index)}
                  />
                  {isOpenEmptyParent && (
                    <AppendZone parentId={element.id} depth={depth + 1} getElements={getElements}>
                      Empty – drag elements here
                    </AppendZone>
                  )}
                </React.Fragment>
              );
            })}
            {/* Lets elements be dragged out of a parent that sits at the end of the list */}
            <AppendZone
              parentId={null}
              depth={0}
              getElements={getElements}
              className={cn(!isDragging && "invisible")}
            >
              Move to top level
            </AppendZone>
          </div>
        )}
      </div>
    </div>
  );
};

// A drop target that appends the dragged element to the end of `parentId`'s children.
const AppendZone = ({
  parentId,
  depth,
  getElements,
  className,
  children,
}: {
  parentId: string | null;
  depth: number;
  getElements: () => PrismaOverlay["elements"];
  className?: string;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ appendTo: parentId }),
      canDrop: ({ source }) => {
        const placement = resolveDrop(getElements(), source.data.id as string, {
          kind: "append",
          parentId,
        });
        return !!placement && !isCurrentPlacement(getElements(), source.data.id as string, placement);
      },
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [parentId, getElements]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-7 items-center rounded-md text-xs italic text-muted-foreground",
        isOver && "bg-chart-1/10 text-foreground",
        className
      )}
      style={{ paddingLeft: depth * INDENT + 26 }}
    >
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-border"
          style={{ left: i * INDENT + 12 }}
        />
      ))}
      {children}
      {isOver && <DropLine left={depth * INDENT + 4} edge="top" />}
    </div>
  );
};
