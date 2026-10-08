import React, { useCallback, useEffect, useRef } from "react";
import {
  CanvasModeEnum,
  ElementTypeEnum,
  isParentType,
  type PrismaOverlay,
} from "@/lib/types";
import { OVERLAY_SELECTION } from "@/components/pages/overlay/editorSelection";
import { childrenOf, isCurrentPlacement, subtreeOf, type Placement } from "./editor/elementlist/tree";
import type { CanvasEditing } from "./canvasEditing";
import type { CanvasSelection } from "./canvasSelection";
import { CANVAS_ELEMENT_ATTRIBUTE } from "./canvasSelection";
import { NO_FEEDBACK, type CanvasInteraction, type DragStore } from "./canvasDrag";
import {
  alignmentGuides,
  CARRYING_ATTRIBUTE,
  contains,
  elementBox,
  FLOW_ROOT_ATTRIBUTE,
  FREE_ITEM_ATTRIBUTE,
  freeArea,
  freeAreaElement,
  measure,
  snap,
  snapOffset,
  type Box,
  type Line,
} from "./canvasGeometry";
import { pathTo, pickTarget } from "./canvasPicking";

// How far a press has to travel (in screen pixels) before it drags instead of clicking.
const DRAG_THRESHOLD = 4;
// How close (in screen pixels) an edge or centre has to come to another to snap to it.
const SNAP_DISTANCE = 6;
// The element stays where it is, faded, while a copy of it is carried to its new place.
const CARRIED_OPACITY = "0.3";

interface Modifiers {
  clientX: number;
  clientY: number;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

type Drop =
  // A freely placed element moved inside its own parent.
  | { kind: "move"; position: { x: number; y: number } }
  // Moved into another parent, or to another index in a laid out one.
  | { kind: "place"; placement: Placement; position: { x: number; y: number } | null };

interface Drag {
  id: string;
  parentId: string | null;
  // The element's own box, faded while a copy of it is carried.
  box: HTMLElement;
  // Its own inline opacity, put back afterwards.
  opacity: string;
  startBox: Box;
  // The x/y a freely placed element is drawn at; null in a laid out parent.
  startPosition: { x: number; y: number } | null;
  // The parents it can be dropped into (not itself, nor anything inside it), deepest last.
  candidates: { id: string; depth: number }[];
  // Nothing but the dragged element moves during a drag, so everything else is measured once.
  boxes: Map<string, { el: Element | null; box: Box | null }>;
  ghost: HTMLElement | null;
  drop: Drop | null;
}

interface Press {
  pointerId: number;
  start: Modifiers;
  last: Modifiers;
  // Where the press started, in canvas pixels.
  startPoint: { x: number; y: number };
  target: string;
  // Selected on a click without a drag, one level below the pressed selection.
  dive: string | null;
  drag: Drag | null;
  // Escape (or a second finger) ended it; the release that follows does nothing.
  cancelled: boolean;
  // Ends it right away, listeners included.
  abort: () => void;
}

const modifiersOf = (e: PointerEvent | React.PointerEvent | KeyboardEvent, previous?: Modifiers): Modifiers => ({
  clientX: "clientX" in e ? e.clientX : (previous?.clientX ?? 0),
  clientY: "clientY" in e ? e.clientY : (previous?.clientY ?? 0),
  altKey: e.altKey,
  shiftKey: e.shiftKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
});

const hitElementId = (target: EventTarget | null, root: HTMLElement) => {
  const el = target instanceof Element ? target.closest(`[${CANVAS_ELEMENT_ATTRIBUTE}]`) : null;
  return el && root.contains(el) ? el.getAttribute(CANVAS_ELEMENT_ATTRIBUTE) : null;
};

const toCanvas = (root: HTMLElement, clientX: number, clientY: number) => {
  const rect = root.getBoundingClientRect();
  const scale = rect.width / root.offsetWidth || 1;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale, scale };
};

// The click that follows a handled press would otherwise select something else again.
const suppressNextClick = () => {
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
};

// Where the dragged element would go in a laid out parent: the index among its future
// siblings, and the line to draw there.
const insertionInto = (
  flowEl: Element,
  flowBox: Box,
  siblings: (Box | null)[],
  point: { x: number; y: number }
): { index: number; line: Line } => {
  const style = getComputedStyle(flowEl);
  const horizontal = style.flexDirection.startsWith("row");
  const reverse = style.flexDirection.endsWith("reverse");
  const start = (b: Box) => (horizontal ? b.left : b.top);
  const end = (b: Box) => (horizontal ? b.left + b.width : b.top + b.height);
  const along = horizontal ? point.x : point.y;
  // On screen, a reversed list runs the other way.
  const isBefore = (b: Box) => (reverse ? start(b) + end(b) > along * 2 : start(b) + end(b) < along * 2);

  let index = siblings.length;
  for (let i = 0; i < siblings.length; i++) {
    const box = siblings[i];
    if (box && !isBefore(box)) {
      index = i;
      break;
    }
  }
  const before = siblings.slice(0, index).filter((b) => b !== null).pop() ?? null;
  const after = siblings[index] ?? null;

  const inset = (side: "Left" | "Right" | "Top" | "Bottom") =>
    (parseFloat(style[`padding${side}`]) || 0) + (parseFloat(style[`border${side}Width`]) || 0);
  let position: number;
  if (before && after) position = reverse ? (start(before) + end(after)) / 2 : (end(before) + start(after)) / 2;
  else if (after) position = reverse ? end(after) : start(after);
  else if (before) position = reverse ? start(before) : end(before);
  else if (horizontal) position = reverse ? flowBox.left + flowBox.width - inset("Right") : flowBox.left + inset("Left");
  else position = reverse ? flowBox.top + flowBox.height - inset("Bottom") : flowBox.top + inset("Top");

  const crossStart = horizontal ? flowBox.top + inset("Top") : flowBox.left + inset("Left");
  const crossEnd = horizontal
    ? flowBox.top + flowBox.height - inset("Bottom")
    : flowBox.left + flowBox.width - inset("Right");
  return {
    index,
    line: {
      axis: horizontal ? "x" : "y",
      position,
      start: crossStart,
      // Still visible in an empty container that has no size.
      end: Math.max(crossEnd, crossStart + 16),
    },
  };
};

// Clicking, dragging and snapping on the editor canvas. Every press is handled here, on the
// overlay's root, rather than by the elements themselves: what a press picks depends on the
// whole tree and the current selection (see pickTarget), not just on what's under the pointer.
export const useCanvasGestures = ({
  rootRef,
  overlay,
  editing,
  selection,
  hoveredIdRef,
  store,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  overlay: PrismaOverlay;
  editing: CanvasEditing | null;
  selection: CanvasSelection | null;
  hoveredIdRef: React.RefObject<string | null>;
  store: DragStore;
}) => {
  const ghostLayerRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  // Read at event time: a press outlives the render it started in.
  const latest = useRef({ overlay, editing, selection });
  useEffect(() => {
    latest.current = { overlay, editing, selection };
  });

  const isFreeParent = (parentId: string | null) => {
    const { overlay } = latest.current;
    return parentId
      ? overlay.elements.find((e) => e.id === parentId)?.type === ElementTypeEnum.GROUP
      : overlay.canvasMode === CanvasModeEnum.FREE;
  };

  const measured = (drag: Drag, key: string, find: () => Element | null) => {
    let entry = drag.boxes.get(key);
    if (!entry) {
      const el = find();
      entry = { el, box: el && rootRef.current ? measure(el, rootRef.current) : null };
      drag.boxes.set(key, entry);
    }
    return entry;
  };

  const canvasBox = (root: HTMLElement): Box => ({
    left: 0,
    top: 0,
    width: root.offsetWidth,
    height: root.offsetHeight,
  });

  const siblingBoxes = (drag: Drag, parentId: string | null) => {
    const root = rootRef.current!;
    return childrenOf(latest.current.overlay.elements, parentId)
      .filter((e) => e.id !== drag.id)
      .map((e) => measured(drag, e.id, () => elementBox(root, e.id)).box);
  };

  // The deepest parent under the point the element can go into; the canvas if there is none.
  const dropParentAt = (drag: Drag, point: { x: number; y: number }) => {
    const root = rootRef.current!;
    let best: { id: string; depth: number; el: Element } | null = null;
    for (const { id, depth } of drag.candidates) {
      const { el, box } = measured(drag, id, () => elementBox(root, id));
      if (!el || !box || !contains(box, point.x, point.y)) continue;
      // Overlapping siblings: the one drawn on top wins.
      const onTop =
        best !== null &&
        depth === best.depth &&
        !!(best.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!best || depth > best.depth || onTop) best = { id, depth, el };
    }
    return best?.id ?? null;
  };

  const setCarried = (drag: Drag, carried: boolean, box: Box) => {
    const root = rootRef.current!;
    if (!carried) {
      if (drag.ghost) drag.ghost.style.display = "none";
      drag.box.style.opacity = drag.opacity;
      root.removeAttribute(CARRYING_ATTRIBUTE);
      return;
    }
    if (!drag.ghost) {
      // A copy of the element as it is drawn, so it looks the same wherever it is carried,
      // even out of a parent that clips it.
      const ghost = document.createElement("div");
      ghost.style.cssText = `position:absolute;width:${drag.startBox.width}px;height:${drag.startBox.height}px;opacity:0.85;`;
      const copy = drag.box.cloneNode(true) as HTMLElement;
      for (const el of [copy, ...copy.querySelectorAll("*")]) {
        el.removeAttribute(CANVAS_ELEMENT_ATTRIBUTE);
        el.removeAttribute(FREE_ITEM_ATTRIBUTE);
        el.removeAttribute("tabindex");
        el.removeAttribute("id");
      }
      copy.style.margin = "0";
      ghost.appendChild(copy);
      ghostLayerRef.current?.appendChild(ghost);
      drag.ghost = ghost;
    }
    drag.ghost.style.display = "";
    drag.ghost.style.left = `${box.left}px`;
    drag.ghost.style.top = `${box.top}px`;
    drag.box.style.opacity = CARRIED_OPACITY;
    root.setAttribute(CARRYING_ATTRIBUTE, "");
  };

  const updateDrag = (current: Press, drag: Drag) => {
    const root = rootRef.current;
    const { editing, overlay } = latest.current;
    if (!root || !editing) return;
    const { last } = current;
    const point = toCanvas(root, last.clientX, last.clientY);
    const moved: Box = {
      ...drag.startBox,
      left: drag.startBox.left + point.x - current.startPoint.x,
      top: drag.startBox.top + point.y - current.startPoint.y,
    };
    // Ctrl/Cmd keeps the element in its parent, wherever it is dragged.
    const parentId = last.ctrlKey || last.metaKey ? drag.parentId : dropParentAt(drag, point);

    if (isFreeParent(parentId)) {
      const same = parentId === drag.parentId && drag.startPosition !== null;
      const areaEl = measured(drag, `area:${parentId}`, () => freeAreaElement(root, parentId)).el;
      if (!areaEl) return;
      const area = freeArea(areaEl, root);
      const targets = [area, canvasBox(root), ...siblingBoxes(drag, parentId)].filter(
        (b): b is Box => b !== null
      );
      const snapping = editing.snapping && !last.altKey && !last.shiftKey;
      let box = moved;
      if (snapping) {
        const { dx, dy } = snapOffset(box, targets, SNAP_DISTANCE / point.scale);
        box = { ...box, left: box.left + dx, top: box.top + dy };
      }
      // Where the parent's x/y count from. Inside its own parent the element keeps any
      // offset its box has from the x/y it is placed at.
      const origin =
        same && drag.startPosition
          ? { left: drag.startBox.left - drag.startPosition.x, top: drag.startBox.top - drag.startPosition.y }
          : { left: area.left, top: area.top };
      const position = {
        x: snap(box.left - origin.left, last.shiftKey),
        y: snap(box.top - origin.top, last.shiftKey),
      };
      box = { ...box, left: origin.left + position.x, top: origin.top + position.y };

      setCarried(drag, !same, box);
      if (same) {
        const unchanged =
          position.x === drag.startPosition!.x && position.y === drag.startPosition!.y;
        drag.drop = unchanged ? null : { kind: "move", position };
      } else {
        const index = childrenOf(overlay.elements, parentId).filter((e) => e.id !== drag.id).length;
        drag.drop = { kind: "place", placement: { parentId, index }, position };
      }
      store.set({
        live: same ? { id: drag.id, ...position } : null,
        feedback: {
          guides: snapping ? alignmentGuides(box, targets) : [],
          insertion: null,
          target: same ? null : area,
          label: { box, text: `${position.x}, ${position.y}` },
        },
      });
      return;
    }

    // A laid out parent: the element is inserted between the siblings nearest the pointer.
    setCarried(drag, true, moved);
    const { el: flowEl, box: flowBox } = measured(drag, `flow:${parentId}`, () =>
      parentId ? elementBox(root, parentId) : root.querySelector(`[${FLOW_ROOT_ATTRIBUTE}]`)
    );
    if (!flowEl || !flowBox) {
      drag.drop = null;
      store.set({ live: null, feedback: NO_FEEDBACK });
      return;
    }
    const { index, line } = insertionInto(flowEl, flowBox, siblingBoxes(drag, parentId), point);
    const placement = { parentId, index };
    if (isCurrentPlacement(overlay.elements, drag.id, placement)) {
      drag.drop = null;
      store.set({ live: null, feedback: NO_FEEDBACK });
      return;
    }
    drag.drop = { kind: "place", placement, position: null };
    store.set({
      live: null,
      feedback: {
        guides: [],
        insertion: line,
        target: parentId !== drag.parentId ? flowBox : null,
        label: null,
      },
    });
  };

  const beginDrag = (id: string): Drag | null => {
    const root = rootRef.current;
    const { overlay } = latest.current;
    const element = overlay.elements.find((e) => e.id === id);
    const box = root && (elementBox(root, id) as HTMLElement | null);
    if (!root || !box || !element) return null;
    const freeItem = root.querySelector<HTMLElement>(`[${FREE_ITEM_ATTRIBUTE}="${CSS.escape(id)}"]`);
    const subtree = new Set(subtreeOf(overlay.elements, id).map((e) => e.id));
    hoveredIdRef.current = null;
    return {
      id,
      parentId: element.parentId ?? null,
      box,
      opacity: box.style.opacity,
      startBox: measure(box, root),
      startPosition: freeItem ? { x: freeItem.offsetLeft, y: freeItem.offsetTop } : null,
      candidates: overlay.elements
        .filter((e) => isParentType(e.type) && !subtree.has(e.id))
        .map((e) => ({ id: e.id, depth: pathTo(overlay.elements, e.id).length })),
      boxes: new Map(),
      ghost: null,
      drop: null,
    };
  };

  const endDrag = (drag: Drag) => {
    drag.ghost?.remove();
    drag.box.style.opacity = drag.opacity;
    rootRef.current?.removeAttribute(CARRYING_ATTRIBUTE);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    const { editing, selection, overlay } = latest.current;
    if (!root || !editing || !selection || e.button !== 0 || press.current) return;
    const hit = hitElementId(e.target, root);
    if (!hit) return;
    // The viewport would pan otherwise.
    e.stopPropagation();

    const { target, dive } = pickTarget(overlay.elements, hit, selection.selectedId, e.ctrlKey || e.metaKey);
    const wasSelected = target === selection.selectedId;
    if (!wasSelected) selection.onSelect(target);
    hoveredIdRef.current = null;

    const start = modifiersOf(e);
    const { x, y } = toCanvas(root, e.clientX, e.clientY);
    const current: Press = {
      pointerId: e.pointerId,
      start,
      last: start,
      startPoint: { x, y },
      target,
      dive: wasSelected ? dive : null,
      drag: null,
      cancelled: false,
      abort: () => {
        cancel();
        finish();
      },
    };
    press.current = current;

    const cancel = () => {
      if (current.drag) endDrag(current.drag);
      current.drag = null;
      current.cancelled = true;
      store.reset();
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== current.pointerId) return;
      current.last = modifiersOf(event);
      if (current.cancelled) return;
      if (!current.drag) {
        const distance = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
        if (distance < DRAG_THRESHOLD) return;
        current.drag = beginDrag(current.target);
        if (!current.drag) {
          current.cancelled = true;
          return;
        }
      }
      updateDrag(current, current.drag);
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== current.pointerId) return;
      finish();
      suppressNextClick();
      if (current.cancelled) return;
      const drag = current.drag;
      if (!drag) {
        if (current.dive) latest.current.selection?.onSelect(current.dive);
        return;
      }
      const drop = drag.drop;
      const editing = latest.current.editing;
      if (drop && editing) {
        if (drop.kind === "move") editing.onMove(drag.id, drop.position);
        else editing.onPlace(drag.id, drop.placement, drop.position);
      }
      // After the change, so the element doesn't flash at its old position in between.
      store.reset();
    };

    // A second finger means a pinch, which the viewport handles.
    const handleOtherDown = (event: PointerEvent) => {
      if (event.pointerId !== current.pointerId) cancel();
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && event.type === "keydown") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        return;
      }
      if (!["Alt", "Shift", "Control", "Meta"].includes(event.key)) return;
      // Alt alone would open the browser's menu bar on release.
      if (event.key === "Alt") event.preventDefault();
      current.last = modifiersOf(event, current.last);
      if (current.drag && !current.cancelled) updateDrag(current, current.drag);
    };

    const handleCancel = (event: PointerEvent) => {
      if (event.pointerId === current.pointerId) current.abort();
    };

    const handleBlur = () => current.abort();

    function finish() {
      if (current.drag) endDrag(current.drag);
      if (press.current === current) press.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("pointerdown", handleOtherDown, true);
      window.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("keyup", handleKey, true);
      window.removeEventListener("blur", handleBlur);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("pointerdown", handleOtherDown, true);
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("keyup", handleKey, true);
    window.addEventListener("blur", handleBlur);
  };

  // Highlights what a click would select.
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    const { selection, overlay } = latest.current;
    if (!root || !selection || press.current) return;
    const hit = hitElementId(e.target, root);
    if (!hit) {
      hoveredIdRef.current = null;
      return;
    }
    const { target, dive } = pickTarget(overlay.elements, hit, selection.selectedId, e.ctrlKey || e.metaKey);
    hoveredIdRef.current = dive ?? (target !== selection.selectedId ? target : null);
  };

  const handlePointerLeave = () => {
    hoveredIdRef.current = null;
  };

  // Clicks the move tool didn't take (the select tool, or the empty canvas).
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    const { selection, overlay } = latest.current;
    if (!root || !selection) return;
    const hit = hitElementId(e.target, root);
    if (!hit) {
      // The empty canvas is the overlay itself: clicking it opens the canvas settings.
      selection.onSelect(OVERLAY_SELECTION);
      return;
    }
    const { target, dive } = pickTarget(overlay.elements, hit, selection.selectedId, e.ctrlKey || e.metaKey);
    selection.onSelect(dive ?? target);
  };

  const snapResize = useCallback<CanvasInteraction["snapResize"]>(
    (groupId, size, modifiers) => {
      const root = rootRef.current;
      const { editing, overlay } = latest.current;
      const el = root && elementBox(root, groupId);
      const element = overlay.elements.find((e) => e.id === groupId);
      if (!root || !el || !element || !editing?.snapping || modifiers.altKey || modifiers.shiftKey) {
        store.set({ feedback: NO_FEEDBACK });
        return size;
      }
      const box = { ...measure(el, root), ...size };
      const parentId = element.parentId ?? null;
      const parentEl = parentId ? elementBox(root, parentId) : null;
      const targets = [
        canvasBox(root),
        ...(parentEl ? [measure(parentEl, root)] : []),
        ...childrenOf(overlay.elements, parentId)
          .filter((e) => e.id !== groupId)
          .map((e) => elementBox(root, e.id))
          .filter((b): b is Element => b !== null)
          .map((b) => measure(b, root)),
      ];
      const { scale } = toCanvas(root, 0, 0);
      const { dx, dy } = snapOffset(box, targets, SNAP_DISTANCE / scale, "end");
      const next = { width: Math.round(size.width + dx), height: Math.round(size.height + dy) };
      store.set({
        feedback: {
          ...NO_FEEDBACK,
          guides: alignmentGuides({ ...box, ...next }, targets, "end"),
        },
      });
      return next;
    },
    [rootRef, store]
  );

  // A drag that is still going when the canvas goes away (or editing is switched off).
  useEffect(() => () => press.current?.abort(), []);

  return {
    ghostLayerRef,
    snapResize,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
      onClick: handleClick,
    },
  };
};
