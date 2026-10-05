import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isParentType, type PrismaOverlay } from "@/lib/types";
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { ChevronsDownUp, ChevronsUpDown, Layers } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddElementModal } from "../AddElementModal";
import { ElementInspector } from "./ElementInspector";
import { DropLine, ElementTreeItem, INDENT } from "./ElementTreeItem";
import {
  applyPlacement,
  childrenOf,
  flattenTree,
  isCurrentPlacement,
  resolveDrop,
  type DropTarget,
} from "./tree";

export interface ElementListEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  selectedId: string | null;
  onSelect: (elementId: string | null) => void;
  // Scroll the settings into view when the selection changes (e.g. picked on the canvas).
  revealSelection?: boolean;
}

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
  selectedId,
  onSelect: setSelectedId,
  revealSelection = false,
}) => {
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(overlay.id));
  const [isDragging, setIsDragging] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey(overlay.id), JSON.stringify([...collapsed]));
  }, [overlay.id, collapsed]);

  const rows = useMemo(
    () => flattenTree(overlay.elements, collapsed),
    [overlay.elements, collapsed]
  );
  const selected = overlay.elements.find((e) => e.id === selectedId) ?? null;

  // The drag handlers read these at event time instead of being re-registered on every
  // render (which would happen on every live update, mid-drag included).
  const latest = useRef({ overlay, onOverlayChange });
  useEffect(() => {
    latest.current = { overlay, onOverlayChange };
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

  useEffect(() => {
    const inspector = inspectorRef.current;
    if (!selectedId || !revealSelection || !inspector) return;
    const { top } = inspector.getBoundingClientRect();
    // Leave it alone if the top of the settings is already comfortably on screen.
    if (top < 96 || top > window.innerHeight - 160) {
      inspector.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId, revealSelection]);

  const parentIds = overlay.elements.filter((e) => isParentType(e.type)).map((e) => e.id);
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));

  // Function to delete an element and all its children recursively
  const deleteElement = async (elementId: string) => {
    const findChildren = (parentId: string): string[] =>
      overlay.elements
        .filter((e) => e.parentId === parentId)
        .flatMap((child) => [child.id, ...findChildren(child.id)]);
    const allIdsToDelete = [elementId, ...findChildren(elementId)];

    if (selectedId && allIdsToDelete.includes(selectedId)) setSelectedId(null);
    onOverlayChange({
      ...overlay,
      elements: overlay.elements.filter((e) => !allIdsToDelete.includes(e.id)),
    });

    // Persist to backend
    await fetch(`/api/elements/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ids: allIdsToDelete,
      }),
    }).catch(console.error);
  };

  useEffect(() => {
    return monitorForElements({
      onDragStart: () => setIsDragging(true),
      onDrop({ source, location }) {
        setIsDragging(false);
        const { overlay, onOverlayChange } = latest.current;
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
        onOverlayChange({ ...overlay, elements: newElements });
        // Make sure the moved element stays visible
        if (placement.parentId) setCollapsedFor(placement.parentId, false);

        // Persist to backend
        fetch(`/api/elements/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            elements: newElements.map(({ id, position, parentId }) => ({
              id,
              position,
              parentId: parentId ?? null,
            })),
            overlayId: overlay.id,
          }),
        }).catch(console.error);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-medium">
          <Layers className="h-5 w-5 text-muted-foreground" />
          Elements
        </h3>
        <div className="flex items-center gap-1">
          {parentIds.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              title={allCollapsed ? "Expand all" : "Collapse all"}
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(parentIds))}
            >
              {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
            </Button>
          )}
          <AddElementModal overlay={overlay} onOverlayChange={onOverlayChange} />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-1">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No elements yet. Add one to get started.
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

      {selected ? (
        <div ref={inspectorRef} className="scroll-mt-24">
          <ElementInspector
            element={selected}
            overlay={overlay}
            onOverlayChange={onOverlayChange}
            onDelete={() => deleteElement(selected.id)}
          />
        </div>
      ) : (
        rows.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Select an element here or in the preview to edit its settings.
          </p>
        )
      )}
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
