import { cn } from "@/lib/utils";
import { isElementVisible, isParentType, type PrismaElement } from "@/lib/types";
import {
  attachInstruction,
  extractInstruction,
  type Instruction,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { ChevronRight, ClipboardPaste, Copy, EyeOff, Pencil, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineRename } from "@/components/ui/inline-rename";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { DragPreview } from "./DragPreview";
import { ElementTypeIcon } from "./ElementTypeIcon";
import { isCurrentPlacement, isInSubtree, resolveDrop, type FlatRow } from "./tree";

export const INDENT = 16;
// Hovering a collapsed parent this long while dragging opens it.
const AUTO_EXPAND_DELAY = 500;

export const ElementTreeItem = ({
  row,
  collapsed,
  selected,
  tabbable,
  getElements,
  onSelect,
  onToggleCollapsed,
  onExpand,
  onKeyDown,
  renaming,
  onStartRename,
  onRenamed,
  canPaste,
  onCopy,
  onPaste,
  onDelete,
}: {
  row: FlatRow;
  collapsed: boolean;
  selected: boolean;
  // The one row reachable with Tab (roving tabindex); the arrow keys move between rows.
  tabbable: boolean;
  getElements: () => PrismaElement[];
  onSelect: () => void;
  onToggleCollapsed: () => void;
  onExpand: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  // Whether the name is being edited in place (double-click or F2).
  renaming: boolean;
  onStartRename: () => void;
  // The new name, or null when it stays as it was.
  onRenamed: (name: string | null) => void;
  // The right-click menu: what a paste does depends on the copied elements, so the row only
  // says whether there is something to paste.
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
}) => {
  const { element, depth, hasChildren } = row;
  const isParent = isParentType(element.type);
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  // Renaming starts once the menu has closed: its focus handling would end it right away.
  const renameAfterMenu = useRef(false);

  // Read by the drag handlers at event time, so live updates don't re-register them
  // (which would cancel a drag in progress).
  const latest = useRef({ element, collapsed, onExpand, renaming });
  useEffect(() => {
    latest.current = { element, collapsed, onExpand, renaming };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let expandTimer: ReturnType<typeof setTimeout> | undefined;
    const clearExpandTimer = () => {
      clearTimeout(expandTimer);
      expandTimer = undefined;
    };

    return combine(
      draggable({
        element: el,
        // Dragging inside the name field selects text instead.
        canDrag: () => !latest.current.renaming,
        getInitialData: () => ({ id: element.id }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
            render: ({ container }) => {
              const root = ReactDOM.createRoot(container);
              root.render(<DragPreview element={latest.current.element} />);
              return () => root.unmount();
            },
          });
        },
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          !isInSubtree(getElements(), element.id, source.data.id as string),
        getData: ({ input, element: targetElement }) =>
          attachInstruction(
            { id: element.id },
            {
              input,
              element: targetElement,
              operations: {
                "reorder-before": "available",
                // Below an open parent is where its first child sits; dropping "after" it
                // there would land somewhere else entirely, so offer "into" instead.
                "reorder-after":
                  isParent && !latest.current.collapsed && hasChildren
                    ? "not-available"
                    : "available",
                combine: isParent ? "available" : "not-available",
              },
            }
          ),
        onDrag: ({ self, source }) => {
          const next = extractInstruction(self.data);
          const sourceId = source.data.id as string;
          // Hide indicators for drops that wouldn't move anything.
          const placement =
            next && resolveDrop(getElements(), sourceId, { kind: next.operation, id: element.id });
          const visible =
            placement && !isCurrentPlacement(getElements(), sourceId, placement) ? next : null;
          setInstruction((current) =>
            current?.operation === visible?.operation ? current : visible
          );

          if (visible?.operation === "combine" && latest.current.collapsed) {
            expandTimer ??= setTimeout(() => latest.current.onExpand(), AUTO_EXPAND_DELAY);
          } else {
            clearExpandTimer();
          }
        },
        onDragLeave: () => {
          setInstruction(null);
          clearExpandTimer();
        },
        onDrop: () => {
          setInstruction(null);
          clearExpandTimer();
        },
      }),
      clearExpandTimer
    );
  }, [element.id, isParent, hasChildren, getElements]);

  const indicatorLeft = depth * INDENT + 4;
  const hidden = !isElementVisible(element);

  return (
    <ContextMenu onOpenChange={(open) => open && !selected && onSelect()}>
      <ContextMenuTrigger asChild>
        <div
          ref={ref}
          role="treeitem"
          aria-selected={selected}
          aria-expanded={isParent ? !collapsed : undefined}
          aria-level={depth + 1}
          tabIndex={tabbable ? 0 : -1}
          data-tree-item-id={element.id}
          // The second click of a double-click is for renaming, it shouldn't unselect the row.
          onClick={(e) => e.detail < 2 && onSelect()}
          onDoubleClick={onStartRename}
          onKeyDown={onKeyDown}
          className={cn(
            "group/row relative flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-sm outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            selected ? "bg-primary/15 text-foreground" : "hover:bg-accent",
            dragging && "opacity-40",
            instruction?.operation === "combine" && "bg-chart-1/20 ring-1 ring-chart-1"
          )}
          style={{ paddingLeft: depth * INDENT + 4 }}
        >
          {/* Guide lines connecting the children of each ancestor */}
          {Array.from({ length: depth }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-border"
              style={{ left: i * INDENT + 12 }}
            />
          ))}

          {isParent ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={collapsed ? "Expand" : "Collapse"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapsed();
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <ElementTypeIcon
            element={element}
            className={cn("h-4 w-4 shrink-0", isParent ? "text-chart-1" : "text-muted-foreground")}
          />
          {renaming ? (
            <InlineRename value={element.name} aria-label="Element name" onDone={onRenamed} />
          ) : (
            <>
              <span className={cn("truncate font-medium", hidden && "text-muted-foreground")}>
                {element.name}
              </span>
              {hidden && (
                <EyeOff aria-label="Hidden" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground opacity-0 group-hover/row:opacity-100">
                {element.type}
              </span>
            </>
          )}

          {(instruction?.operation === "reorder-before" ||
            instruction?.operation === "reorder-after") && (
            <DropLine
              left={indicatorLeft}
              edge={instruction.operation === "reorder-before" ? "top" : "bottom"}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          if (!renameAfterMenu.current) return;
          renameAfterMenu.current = false;
          e.preventDefault();
          onStartRename();
        }}
      >
        <ContextMenuItem onSelect={() => (renameAfterMenu.current = true)}>
          <Pencil />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onCopy}>
          <Copy />
          Copy
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!canPaste} onSelect={onPaste}>
          <ClipboardPaste />
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

// The insertion line shown between rows while dragging.
export const DropLine = ({ left, edge }: { left: number; edge: "top" | "bottom" }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute right-0 z-10 h-0.5 bg-chart-1"
    style={{ left: left + 6, [edge]: -1 }}
  >
    <span className="absolute -left-1.5 -top-[3px] h-2 w-2 rounded-full border-2 border-chart-1 bg-background" />
  </div>
);
