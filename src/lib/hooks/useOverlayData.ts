import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { OverlayChange, PrismaElement, PrismaOverlay } from "@/lib/types";
import { connectOverlaySocket } from "@/lib/overlaySocket";
import { applyBingoDataUpdate, normalizeBingoData, type BingoDataUpdate } from "@/lib/bingo";
import { applyTimerAction, type TimerAction } from "@/lib/timer";
import { applyCountdownAction, type CountdownAction } from "@/lib/countdown";
import { ApiError, sharingApi, type OverlayAccess } from "@/lib/sharing";

const DEBOUNCE_MS = 500;
// How long a deletion can be undone. The elements only disappear locally until then; the
// request is sent once the time is up (or right away when the page is left).
export const UNDO_DELETE_MS = 8000;

// How changes and other people's changes come together:
//
// - The server state (`serverOverlay`) is the latest snapshot received, by fetch or broadcast.
//   Snapshots carry a revision, so an older one arriving late never replaces a newer one.
// - Every local change is shown right away as a layer over that state, and stays laid over it
//   until a snapshot arrives that contains it (or it failed). What's on screen is always the
//   server state plus the user's own changes that are still on their way, so other people's
//   changes show up immediately and the user's own don't flicker back while being saved.
// - Changes are sent as what the user did rather than the resulting state wherever two people
//   could do it at once: "+1" for counters, "pause" for timers, single cells for bingo cards,
//   only the changed keys for styles. The server applies them to its current state.
//
// Requests go through one queue per field (an element's style, a counter, ...). Changes to the
// same field are combined while they wait and sent one at a time, so they land in order;
// changes to different fields don't hold each other up.
interface WriteRequest {
  url: string;
  method?: "PATCH" | "POST" | "DELETE";
  body: object;
}

interface Layer {
  apply: (overlay: PrismaOverlay) => void;
  // Set when the request is sent; the broadcast it causes carries the same id.
  writeId?: string;
  // The first revision known to contain the change. The layer is dropped once that (or a
  // later) revision has been received.
  revision?: number;
}

interface QueuedRequest extends WriteRequest {
  layer: Layer;
  timer?: ReturnType<typeof setTimeout>;
}

interface WriteQueue {
  // Waiting to be sent: for its debounce, or for the request before it to finish.
  queued: QueuedRequest | null;
  inFlight: boolean;
}

interface WriteOptions {
  delay?: number;
  // Folds a new body into one that hasn't been sent yet. Without it the newer body replaces
  // the older one, which is right whenever a body holds the complete value.
  combine?: (queued: object, next: object) => object;
}

// Cancels a write that hasn't been sent yet and returns its layer.
const cancelQueued = (write: WriteQueue) => {
  const queued = write.queued;
  if (!queued) return null;
  clearTimeout(queued.timer);
  write.queued = null;
  return queued.layer;
};

const findElement = (overlay: PrismaOverlay, elementId: string) =>
  overlay.elements.find((el) => el.id === elementId);

const resolveChange = (change: OverlayChange, current: PrismaOverlay) =>
  typeof change === "function" ? change(current) : change;

const isEqual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const writeIdPrefix = Math.random().toString(36).slice(2, 10);
let writeCount = 0;
const nextWriteId = () => `${writeIdPrefix}-${++writeCount}`;

type StylePatch = Record<string, unknown>;

// The keys that differ between two styles; removed keys are sent as null.
const diffStyle = (before: unknown, after: unknown): StylePatch => {
  const a = (before ?? {}) as StylePatch;
  const b = (after ?? {}) as StylePatch;
  const patch: StylePatch = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!isEqual(a[key], b[key])) patch[key] = b[key] ?? null;
  }
  return patch;
};

const applyStylePatch = (style: unknown, patch: StylePatch) => {
  const next = { ...((style ?? {}) as StylePatch) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
};

const combineStyle =
  (field: "style" | "globalStyle") =>
  (queued: object, next: object): object => ({
    [field]: {
      ...(queued as Record<string, StylePatch>)[field],
      ...(next as Record<string, StylePatch>)[field],
    },
  });

type CounterBody = { data: { value?: number; increment?: number } };

const combineCounter = (queued: object, next: object): object => {
  const q = (queued as CounterBody).data;
  const n = (next as CounterBody).data;
  // A typed value replaces whatever was waiting.
  if (n.increment === undefined) return next;
  if (q.increment !== undefined) return { data: { increment: q.increment + n.increment } };
  return { data: { value: (q.value ?? 0) + n.increment } };
};

type ActionsBody = { data: { actions: (TimerAction | CountdownAction)[] } };

// Timer and countdown actions waiting to be sent go out together, in the order they were made.
const combineActions = (queued: object, next: object): object => ({
  data: {
    actions: [...(queued as ActionsBody).data.actions, ...(next as ActionsBody).data.actions],
  },
});

type BingoBody = { data: BingoDataUpdate };

const mergeCells = <T>(
  queued: T[] | Record<number, T> | undefined,
  next: T[] | Record<number, T> | undefined
) => {
  if (queued === undefined || next === undefined || Array.isArray(next)) return next ?? queued;
  if (!Array.isArray(queued)) return { ...queued, ...next };
  const cells = [...queued];
  for (const [index, value] of Object.entries(next)) cells[Number(index)] = value;
  return cells;
};

const combineBingo = (queued: object, next: object): object => {
  const q = (queued as BingoBody).data;
  const n = (next as BingoBody).data;
  const data: BingoDataUpdate = { ...q, ...n };
  const fields = mergeCells(q.fields, n.fields);
  const checked = mergeCells(q.checked, n.checked);
  if (fields !== undefined) data.fields = fields;
  if (checked !== undefined) data.checked = checked;
  return { data };
};

export const useOverlayData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlayState] = useState<PrismaOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What the user may do with the overlay (and who else has access). Null until it's known.
  const [access, setAccess] = useState<OverlayAccess | null>(null);

  // Mirrors `overlay` synchronously so handlers invoked from stale closures (debounced
  // editors, drag and drop monitors, socket callbacks) always build on the latest state.
  const overlayRef = useRef<PrismaOverlay | null>(null);
  // The latest server state, without local changes.
  const serverOverlay = useRef<PrismaOverlay | null>(null);
  const layers = useRef<Layer[]>([]);
  const writes = useRef(new Map<string, WriteQueue>());
  // Responses that arrive after switching to another overlay must not touch the new one.
  const activeId = useRef(id);
  // Set while this user deletes the overlay, so its own deletion isn't reported as someone
  // else's.
  const deletingOverlay = useRef(false);

  const setOverlay = useCallback((next: PrismaOverlay | null) => {
    overlayRef.current = next;
    setOverlayState(next);
  }, []);

  // Shows the server state with the local changes that it doesn't contain yet laid over it.
  const render = useCallback(() => {
    const server = serverOverlay.current;
    if (!server) return;
    if (layers.current.length === 0) {
      setOverlay(server);
      return;
    }
    const merged: PrismaOverlay = structuredClone(server);
    layers.current.forEach((layer) => layer.apply(merged));
    setOverlay(merged);
  }, [setOverlay]);

  const removeLayer = useCallback((layer: Layer) => {
    layers.current = layers.current.filter((l) => l !== layer);
  }, []);

  const applyServerOverlay = useCallback(
    ({ writeId, ...snapshot }: PrismaOverlay & { writeId?: string }) => {
      if (snapshot.id !== activeId.current) return;
      const current = serverOverlay.current;
      // A fetch that started before a broadcast, or broadcasts overtaking each other.
      if (current && snapshot.revision < current.revision) return;
      serverOverlay.current = snapshot;

      const { revision } = snapshot;
      layers.current = layers.current.filter((layer) => {
        if (writeId && layer.writeId === writeId) return false;
        return layer.revision === undefined || layer.revision > revision;
      });
      render();
    },
    [render]
  );

  // Re-read whenever access to the overlay changes, so someone demoted or removed while the
  // page is open sees it right away instead of when their next change fails.
  const refreshAccess = useCallback(async () => {
    if (!id) return;
    try {
      setAccess(await sharingApi.overlayAccess(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAccess(null);
        setError("You no longer have access to this overlay.");
      } else {
        console.error("Failed to refresh access", err);
      }
    }
  }, [id]);

  const fetchOverlayData = useCallback(async () => {
    const response = await fetch(`/api/overlays/${id}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? "This overlay doesn't exist, or it isn't shared with you."
          : "Failed to fetch overlay"
      );
    }
    return (await response.json()) as PrismaOverlay;
  }, [id]);

  // Quiet refetch used when the live connection (re)opens and after a failed save.
  const refreshOverlay = useCallback(async () => {
    try {
      applyServerOverlay(await fetchOverlayData());
    } catch (err) {
      console.error("Failed to refresh overlay", err);
    }
  }, [fetchOverlayData, applyServerOverlay]);

  const sendWrite = useCallback(
    async (key: string) => {
      const write = writes.current.get(key);
      if (!write || write.inFlight) return;
      write.inFlight = true;

      // Loop (rather than recurse) so a change queued mid-flight goes out after this request.
      // One that is still waiting for its debounce is sent by its timer instead.
      let request: QueuedRequest | null;
      while ((request = write.queued) && !request.timer) {
        write.queued = null;
        const { url, method = "PATCH", body, layer } = request;
        const writeId = nextWriteId();
        layer.writeId = writeId;
        let revision: number | undefined;
        let failed = false;
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", "X-Write-Id": writeId },
            body: JSON.stringify(body),
            credentials: "include",
          });
          if (!response.ok) throw new Error(`Failed to update (${response.status})`);
          const header = response.headers.get("X-Overlay-Revision");
          revision = header ? Number(header) : undefined;
        } catch (err) {
          console.error(err);
          failed = true;
        }

        // The page was left or switched to another overlay in the meantime.
        if (writes.current.get(key) !== write) return;

        if (layers.current.includes(layer)) {
          const received = serverOverlay.current?.revision ?? -1;
          if (failed || revision === undefined || received >= revision) {
            removeLayer(layer);
            render();
          } else {
            layer.revision = revision;
          }
        }
        // Don't leave the UI showing a value the server never accepted.
        if (failed) refreshOverlay();
      }

      write.inFlight = false;
      if (!write.queued) writes.current.delete(key);
    },
    [refreshOverlay, removeLayer, render]
  );

  const queueWrite = useCallback(
    (
      key: string,
      request: WriteRequest,
      apply: (overlay: PrismaOverlay) => void,
      { delay = 0, combine }: WriteOptions = {}
    ) => {
      let write = writes.current.get(key);
      if (!write) {
        write = { queued: null, inFlight: false };
        writes.current.set(key, write);
      }
      const queued = write.queued;
      if (queued) {
        clearTimeout(queued.timer);
        queued.timer = undefined;
        queued.url = request.url;
        queued.method = request.method;
        queued.body = combine ? combine(queued.body, request.body) : request.body;
        const previous = queued.layer.apply;
        queued.layer.apply = (target) => {
          previous(target);
          apply(target);
        };
      } else {
        const layer: Layer = { apply };
        layers.current.push(layer);
        write.queued = { ...request, layer };
      }
      const pending = write.queued!;
      if (delay > 0) {
        pending.timer = setTimeout(() => {
          pending.timer = undefined;
          sendWrite(key);
        }, delay);
      } else {
        sendWrite(key);
      }
    },
    [sendWrite]
  );

  // Applies a change to one element locally and queues the matching write.
  const updateElement = useCallback(
    (
      elementId: string,
      field: string,
      body: object,
      mutate: (el: PrismaElement) => void,
      options?: WriteOptions
    ) => {
      const current = overlayRef.current;
      if (!current || !findElement(current, elementId)) return;
      const apply = (target: PrismaOverlay) => {
        const el = findElement(target, elementId);
        if (el) mutate(el);
      };
      const next: PrismaOverlay = structuredClone(current);
      apply(next);
      setOverlay(next);
      queueWrite(
        `${elementId}:${field}`,
        { url: `/api/elements/${elementId}`, body },
        apply,
        options
      );
    },
    [queueWrite, setOverlay]
  );

  useEffect(() => {
    if (!id) return;
    let disposed = false;
    activeId.current = id;
    const pending = writes.current;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [data, initialAccess] = await Promise.all([
          fetchOverlayData(),
          sharingApi.overlayAccess(id),
        ]);
        if (disposed) return;
        setAccess(initialAccess);
        applyServerOverlay(data);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "An unknown error occurred");
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };
    load();

    // Only `id` may restart the socket: reconnecting on every state change would drop
    // broadcasts that arrive in between.
    const disconnect = connectOverlaySocket(id, {
      onOverlay: applyServerOverlay,
      onOpen: refreshOverlay,
      onAccessChange: refreshAccess,
      onDeleted: () => {
        if (deletingOverlay.current) return;
        pending.forEach(cancelQueued);
        pending.clear();
        setError("This overlay has been deleted.");
      },
    });

    return () => {
      disposed = true;
      disconnect();
      // Leaving the page must not drop edits that are still waiting for their debounce (or
      // for an earlier request to the same field to finish).
      pending.forEach(({ queued }) => {
        if (!queued) return;
        clearTimeout(queued.timer);
        fetch(queued.url, {
          method: queued.method ?? "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queued.body),
          credentials: "include",
          keepalive: true,
        }).catch(console.error);
      });
      pending.clear();
      layers.current = [];
      serverOverlay.current = null;
      activeId.current = undefined;
      setOverlay(null);
    };
  }, [id, fetchOverlayData, applyServerOverlay, refreshOverlay, refreshAccess, setOverlay]);

  // Elements that are gone locally must not receive their queued writes any more (they
  // would only fail with a 404 once the delete has gone through).
  const dropWritesForRemoved = useCallback(
    (current: PrismaOverlay, next: PrismaOverlay) => {
      const remaining = new Set(next.elements.map((el) => el.id));
      for (const el of current.elements) {
        if (remaining.has(el.id)) continue;
        for (const [key, write] of writes.current) {
          if (!key.startsWith(`${el.id}:`)) continue;
          const layer = cancelQueued(write);
          if (layer) removeLayer(layer);
          if (!write.inFlight) writes.current.delete(key);
        }
      }
    },
    [removeLayer]
  );

  // Persists whatever changed between the current overlay and the new one (global style and
  // element styles) and adopts the new one as local state. Structure (adding, deleting,
  // moving elements) is persisted by the caller or through handleStructureChange.
  const handleOverlayChange = useCallback(
    (change: OverlayChange) => {
      const current = overlayRef.current;
      if (!current) return;
      const updatedOverlay = resolveChange(change, current);

      // The canvas itself: its size and how it places the elements on it. Only the changed
      // keys are sent, like with globalStyle.
      const canvas: Record<string, unknown> = {};
      for (const key of ["width", "height", "canvasMode"] as const) {
        if (current[key] !== updatedOverlay[key]) canvas[key] = updatedOverlay[key];
      }
      if (Object.keys(canvas).length > 0) {
        queueWrite(
          "overlay:canvas",
          { url: `/api/overlays/${current.id}`, body: canvas },
          (target) => Object.assign(target, canvas),
          { delay: DEBOUNCE_MS, combine: (queued) => ({ ...(queued as object), ...canvas }) }
        );
      }

      // Only the changed keys are sent, so someone else changing another property at the
      // same time keeps their change.
      const globalStyle = diffStyle(current.globalStyle, updatedOverlay.globalStyle);
      if (Object.keys(globalStyle).length > 0) {
        queueWrite(
          "overlay:globalStyle",
          { url: `/api/overlays/${current.id}`, body: { globalStyle } },
          (target) => {
            target.globalStyle = applyStylePatch(
              target.globalStyle,
              globalStyle
            ) as unknown as PrismaOverlay["globalStyle"];
          },
          { delay: DEBOUNCE_MS, combine: combineStyle("globalStyle") }
        );
      }

      // `elements` is the flat list of every element, nested ones included.
      const originalById = new Map(current.elements.map((el) => [el.id, el]));
      for (const element of updatedOverlay.elements) {
        const original = originalById.get(element.id);
        if (!original) continue;
        const style = diffStyle(original.style, element.style);
        if (Object.keys(style).length === 0) continue;
        queueWrite(
          `${element.id}:style`,
          { url: `/api/elements/${element.id}`, body: { style } },
          (target) => {
            const el = findElement(target, element.id);
            if (el) el.style = applyStylePatch(el.style, style);
          },
          { delay: DEBOUNCE_MS, combine: combineStyle("style") }
        );
      }

      dropWritesForRemoved(current, updatedOverlay);
      setOverlay(updatedOverlay);
    },
    [queueWrite, setOverlay, dropWritesForRemoved]
  );

  // Moving or deleting elements: applied locally right away and persisted with `request`.
  // Until the server confirms it, the new tree is laid over incoming broadcasts (which
  // would otherwise put moved elements back for a moment), and a failure resyncs the UI.
  const handleStructureChange = useCallback(
    (change: OverlayChange, key: string, request: WriteRequest) => {
      const current = overlayRef.current;
      if (!current) return;
      const next = resolveChange(change, current);

      const placement = new Map(
        next.elements.map((el) => [el.id, { parentId: el.parentId ?? null, position: el.position }])
      );
      const removed = new Set(
        current.elements.filter((el) => !placement.has(el.id)).map((el) => el.id)
      );
      const apply = (target: PrismaOverlay) => {
        target.elements = target.elements.filter((el) => !removed.has(el.id));
        for (const el of target.elements) {
          const place = placement.get(el.id);
          if (place) Object.assign(el, place);
        }
      };

      dropWritesForRemoved(current, next);
      setOverlay(next);
      queueWrite(`structure:${key}`, request, apply);
    },
    [queueWrite, setOverlay, dropWritesForRemoved]
  );

  // Hides the elements right away but holds the request back for UNDO_DELETE_MS, so undoing
  // only has to cancel it. Queued edits to the elements are kept: they still exist on the
  // server, and undo brings them back with those edits. Returns the key to undo it with.
  const handleDeleteElements = useCallback(
    (ids: string[]) => {
      const current = overlayRef.current;
      if (!current || ids.length === 0) return null;
      const removed = new Set(ids);
      const apply = (target: PrismaOverlay) => {
        target.elements = target.elements.filter((el) => !removed.has(el.id));
      };
      const next: PrismaOverlay = { ...current, elements: current.elements };
      apply(next);
      setOverlay(next);
      const key = `delete:${ids.join(",")}`;
      queueWrite(
        key,
        { url: "/api/elements/delete", method: "DELETE", body: { ids } },
        apply,
        { delay: UNDO_DELETE_MS }
      );
      return { key, elements: current.elements.filter((el) => removed.has(el.id)) };
    },
    [queueWrite, setOverlay]
  );

  // Puts the elements back, unless the deletion has already been sent. Returns whether it
  // could be undone.
  const handleUndoDelete = useCallback(
    (deletion: { key: string; elements: PrismaElement[] }) => {
      const write = writes.current.get(deletion.key);
      // Too late once the request has been sent.
      if (!write?.queued?.timer) return false;
      const layer = cancelQueued(write)!;
      if (!write.inFlight) writes.current.delete(deletion.key);
      // The server still has the elements, including whatever others changed on them
      // meanwhile, so dropping the deletion's layer brings them back as they are now.
      removeLayer(layer);
      render();
      return true;
    },
    [removeLayer, render]
  );

  // Typing a value: the last one typed wins.
  const handleCounterChange = useCallback(
    (elementId: string, value: number) => {
      updateElement(
        elementId,
        "counter",
        { data: { value } },
        (el) => {
          if (el.counter) el.counter.value = value;
        },
        { delay: DEBOUNCE_MS, combine: combineCounter }
      );
    },
    [updateElement]
  );

  // The +/- buttons: sent as a step, so clicks by several people at once all count.
  const handleCounterIncrement = useCallback(
    (elementId: string, increment: number) => {
      updateElement(
        elementId,
        "counter",
        { data: { increment } },
        (el) => {
          if (el.counter) el.counter.value += increment;
        },
        { combine: combineCounter }
      );
    },
    [updateElement]
  );

  const handleTitleChange = useCallback(
    (elementId: string, text: string) => {
      updateElement(
        elementId,
        "title",
        { data: { text } },
        (el) => {
          if (el.title) el.title.text = text;
        },
        { delay: DEBOUNCE_MS }
      );
    },
    [updateElement]
  );

  const handleImageChange = useCallback(
    (elementId: string, src: string) => {
      updateElement(elementId, "image", { data: { src } }, (el) => {
        if (el.image) el.image.src = src;
      });
    },
    [updateElement]
  );

  // Single mutation path for bingo data: applied locally first so the editor and preview
  // stay in step, then persisted. Cells are sent as `{ index: value }` patches, so people
  // marking or editing different cells don't overwrite each other.
  const handleBingoDataChange = useCallback(
    (elementId: string, data: BingoDataUpdate) => {
      const reshapesCard =
        data.rows !== undefined || data.columns !== undefined || data.freeMiddle !== undefined;
      updateElement(
        elementId,
        reshapesCard ? "bingoCard" : "bingoCells",
        { data },
        (el) => {
          if (!el.bingo) return;
          const next = applyBingoDataUpdate(normalizeBingoData(el.bingo), data);
          el.bingo.rows = next.rows;
          el.bingo.columns = next.columns;
          el.bingo.freeMiddle = next.freeMiddle;
          el.bingo.fields = next.fields;
          el.bingo.checked = next.checked;
        },
        { combine: combineBingo }
      );
    },
    [updateElement]
  );

  // Timers are changed through actions the server applies to the timer as it is then, so
  // two people pausing or adding time at once get what each of them clicked.
  const timerAction = useCallback(
    (elementId: string, action: TimerAction) => {
      // Fixed now, so recomputing the local state later doesn't move the timer.
      const now = Date.now();
      updateElement(
        elementId,
        "timer",
        { data: { actions: [action] } },
        (el) => {
          if (el.timer) el.timer = applyTimerAction(el.timer, action, now);
        },
        { combine: combineActions }
      );
    },
    [updateElement]
  );

  const handleTimerToggle = useCallback(
    (elementId: string) => {
      const timer = overlayRef.current && findElement(overlayRef.current, elementId)?.timer;
      if (!timer) return;
      // What the button showed: someone else starting it a moment earlier doesn't turn this
      // "start" into a pause.
      timerAction(elementId, { type: timer.startedAt ? "pause" : "start" });
    },
    [timerAction]
  );

  const handleTimerReset = useCallback(
    (elementId: string) => timerAction(elementId, { type: "reset" }),
    [timerAction]
  );

  const handleTimerAddTime = useCallback(
    (elementId: string, ms: number) => timerAction(elementId, { type: "addTime", ms }),
    [timerAction]
  );

  // Countdowns work like timers: the server applies each action to the countdown as it is then.
  const handleCountdownAction = useCallback(
    (elementId: string, action: CountdownAction) => {
      // Fixed now, so recomputing the local state later doesn't move the countdown.
      const now = Date.now();
      updateElement(
        elementId,
        "countdown",
        { data: { actions: [action] } },
        (el) => {
          if (el.countdown) el.countdown = applyCountdownAction(el.countdown, action, now);
        },
        { combine: combineActions }
      );
    },
    [updateElement]
  );

  const handleDeleteOverlay = async () => {
    deletingOverlay.current = true;
    try {
      const response = await fetch(`/api/overlays/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Only the owner can delete this overlay"
            : "Failed to delete overlay"
        );
      }
      // Nothing left to save edits into.
      writes.current.forEach(cancelQueued);
      writes.current.clear();
      navigate("/");
    } catch (err) {
      deletingOverlay.current = false;
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  return {
    id,
    overlay,
    access,
    role: access?.role ?? null,
    refreshAccess,
    setOverlay,
    isLoading,
    error,
    handleOverlayChange,
    handleStructureChange,
    handleDeleteElements,
    handleUndoDelete,
    handleCounterChange,
    handleCounterIncrement,
    handleTitleChange,
    handleImageChange,
    handleBingoDataChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerAddTime,
    handleCountdownAction,
    handleDeleteOverlay,
  };
};
