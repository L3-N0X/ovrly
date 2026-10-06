import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { OverlayChange, PrismaElement, PrismaOverlay } from "@/lib/types";
import { connectOverlaySocket } from "@/lib/overlaySocket";
import { applyBingoDataUpdate, normalizeBingoData, type BingoDataUpdate } from "@/lib/bingo";

const DEBOUNCE_MS = 500;

type TimerState = NonNullable<PrismaElement["timer"]>;

// One queued write per field (an element's style, a counter's value, ...). Writes to the same
// field are coalesced and sent one at a time, so the latest value always lands last; writes
// to different fields don't interfere with each other.
interface WriteRequest {
  url: string;
  method?: "PATCH" | "POST" | "DELETE";
  body: object;
}

interface PendingWrite extends WriteRequest {
  // Re-applies the local value on top of server state that doesn't include it yet.
  apply: (overlay: PrismaOverlay) => void;
  version: number;
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  resend: boolean;
}

const findElement = (overlay: PrismaOverlay, elementId: string) =>
  overlay.elements.find((el) => el.id === elementId);

const resolveChange = (change: OverlayChange, current: PrismaOverlay) =>
  typeof change === "function" ? change(current) : change;

const isEqual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Pausing folds the running stretch into `pausedAt`, which stores the accumulated elapsed
// time as a timestamp relative to the epoch.
const elapsedMs = ({ startedAt, pausedAt }: TimerState) => {
  let elapsed = pausedAt ? new Date(pausedAt).getTime() : 0;
  if (startedAt) elapsed += Date.now() - new Date(startedAt).getTime();
  return elapsed;
};

export const useOverlayData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlayState] = useState<PrismaOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirrors `overlay` synchronously so handlers invoked from stale closures (debounced
  // editors, drag and drop monitors, socket callbacks) always build on the latest state.
  const overlayRef = useRef<PrismaOverlay | null>(null);
  const pendingWrites = useRef(new Map<string, PendingWrite>());
  const writeVersion = useRef(0);
  // Bumped whenever server state arrives over the socket; a fetch that started before then
  // returns older data and is discarded.
  const serverRevision = useRef(0);

  const setOverlay = useCallback((next: PrismaOverlay | null) => {
    overlayRef.current = next;
    setOverlayState(next);
  }, []);

  // Server state doesn't contain local edits that are still waiting to be saved (or whose
  // save hasn't been broadcast yet). Applying it as-is would make inputs jump back while
  // the user is typing, so pending values are laid over it.
  const applyServerOverlay = useCallback(
    (serverOverlay: PrismaOverlay) => {
      if (pendingWrites.current.size === 0) {
        setOverlay(serverOverlay);
        return;
      }
      const merged: PrismaOverlay = structuredClone(serverOverlay);
      pendingWrites.current.forEach((write) => write.apply(merged));
      setOverlay(merged);
    },
    [setOverlay]
  );

  const fetchOverlayData = useCallback(async () => {
    const revision = serverRevision.current;
    const response = await fetch(`/api/overlays/${id}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Failed to fetch overlay");
    }
    const data: PrismaOverlay = await response.json();
    return revision === serverRevision.current ? data : null;
  }, [id]);

  // Quiet refetch used when the live connection (re)opens and after a failed save.
  const refreshOverlay = useCallback(async () => {
    try {
      const data = await fetchOverlayData();
      if (data) applyServerOverlay(data);
    } catch (err) {
      console.error("Failed to refresh overlay", err);
    }
  }, [fetchOverlayData, applyServerOverlay]);

  const sendWrite = useCallback(
    async (key: string) => {
      const write = pendingWrites.current.get(key);
      if (!write) return;
      clearTimeout(write.timer);
      write.timer = undefined;
      if (write.inFlight) {
        // Sent once the current request finishes, so requests can't overtake each other.
        write.resend = true;
        return;
      }

      write.inFlight = true;
      let failed: boolean;
      let version: number;
      // Loop (rather than recurse) so a resend queued mid-flight goes out after this request.
      do {
        write.resend = false;
        const { url, method = "PATCH", body } = write;
        version = write.version;
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: "include",
          });
          if (!response.ok) throw new Error(`Failed to update (${response.status})`);
          failed = false;
        } catch (err) {
          console.error(err);
          failed = true;
        }
      } while (write.resend);
      write.inFlight = false;

      if (write.version === version && !write.timer) {
        pendingWrites.current.delete(key);
      }
      // Don't leave the UI showing a value the server never accepted.
      if (failed) refreshOverlay();
    },
    [refreshOverlay]
  );

  const queueWrite = useCallback(
    (
      key: string,
      request: WriteRequest,
      apply: (overlay: PrismaOverlay) => void,
      delay = 0
    ) => {
      const write: PendingWrite = pendingWrites.current.get(key) ?? {
        ...request,
        apply,
        version: 0,
        inFlight: false,
        resend: false,
      };
      Object.assign(write, { method: undefined, ...request, apply, version: ++writeVersion.current });
      pendingWrites.current.set(key, write);
      clearTimeout(write.timer);
      write.timer = undefined;
      if (delay > 0) {
        write.timer = setTimeout(() => sendWrite(key), delay);
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
      delay = 0
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
      queueWrite(`${elementId}:${field}`, { url: `/api/elements/${elementId}`, body }, apply, delay);
    },
    [queueWrite, setOverlay]
  );

  useEffect(() => {
    if (!id) return;
    let disposed = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchOverlayData();
        if (!disposed && data) applyServerOverlay(data);
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
      onOverlay: (updatedOverlay) => {
        serverRevision.current++;
        applyServerOverlay(updatedOverlay);
      },
      onOpen: refreshOverlay,
    });

    const writes = pendingWrites.current;
    return () => {
      disposed = true;
      disconnect();
      // Leaving the page must not drop edits that are still waiting for their debounce (or
      // for an earlier request to the same field to finish).
      writes.forEach((write) => {
        if (!write.timer && !write.resend) return;
        clearTimeout(write.timer);
        fetch(write.url, {
          method: write.method ?? "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(write.body),
          credentials: "include",
          keepalive: true,
        }).catch(console.error);
      });
      writes.clear();
      setOverlay(null);
    };
  }, [id, fetchOverlayData, applyServerOverlay, refreshOverlay, setOverlay]);

  // Elements that are gone locally must not receive their queued writes any more (they
  // would only fail with a 404 once the delete has gone through).
  const dropWritesForRemoved = useCallback((current: PrismaOverlay, next: PrismaOverlay) => {
    const remaining = new Set(next.elements.map((el) => el.id));
    for (const el of current.elements) {
      if (remaining.has(el.id)) continue;
      for (const [key, write] of pendingWrites.current) {
        if (key.startsWith(`${el.id}:`) && !write.inFlight) {
          clearTimeout(write.timer);
          pendingWrites.current.delete(key);
        }
      }
    }
  }, []);

  // Persists whatever changed between the current overlay and the new one (global style and
  // element styles) and adopts the new one as local state. Structure (adding, deleting,
  // moving elements) is persisted by the caller or through handleStructureChange.
  const handleOverlayChange = useCallback(
    (change: OverlayChange) => {
      const current = overlayRef.current;
      if (!current) return;
      const updatedOverlay = resolveChange(change, current);

      if (!isEqual(updatedOverlay.globalStyle, current.globalStyle)) {
        const globalStyle = updatedOverlay.globalStyle;
        queueWrite(
          "overlay:globalStyle",
          { url: `/api/overlays/${current.id}`, body: { globalStyle } },
          (target) => {
            target.globalStyle = globalStyle;
          },
          DEBOUNCE_MS
        );
      }

      // `elements` is the flat list of every element, nested ones included.
      const originalById = new Map(current.elements.map((el) => [el.id, el]));
      for (const element of updatedOverlay.elements) {
        const original = originalById.get(element.id);
        if (!original || isEqual(element.style, original.style)) continue;
        const style = element.style;
        queueWrite(
          `${element.id}:style`,
          { url: `/api/elements/${element.id}`, body: { style } },
          (target) => {
            const el = findElement(target, element.id);
            if (el) el.style = style;
          },
          DEBOUNCE_MS
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

  const handleCounterChange = useCallback(
    (elementId: string, value: number) => {
      updateElement(
        elementId,
        "counter",
        { data: { value } },
        (el) => {
          if (el.counter) el.counter.value = value;
        },
        DEBOUNCE_MS
      );
    },
    [updateElement]
  );

  const handleImmediateCounterChange = useCallback(
    (elementId: string, value: number) => {
      updateElement(elementId, "counter", { data: { value } }, (el) => {
        if (el.counter) el.counter.value = value;
      });
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
        DEBOUNCE_MS
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
  // stay in step, then persisted.
  const handleBingoDataChange = useCallback(
    (elementId: string, data: BingoDataUpdate) => {
      updateElement(elementId, "bingo", { data }, (el) => {
        if (!el.bingo) return;
        const next = applyBingoDataUpdate(normalizeBingoData(el.bingo), data);
        el.bingo.size = next.size;
        el.bingo.freeMiddle = next.freeMiddle;
        el.bingo.fields = next.fields;
        el.bingo.checked = next.checked;
      });
    },
    [updateElement]
  );

  // Timer writes always carry the complete timer state, so coalescing them can't lose a
  // field that only an earlier write contained.
  const writeTimer = useCallback(
    (elementId: string, compute: (timer: TimerState) => Partial<TimerState>) => {
      const current = overlayRef.current;
      const timer = current && findElement(current, elementId)?.timer;
      if (!timer) return;
      const next: TimerState = { ...timer, ...compute(timer) };
      const { startedAt, pausedAt, duration, countDown } = next;
      updateElement(elementId, "timer", { data: { startedAt, pausedAt, duration, countDown } }, (el) => {
        if (el.timer) el.timer = { ...el.timer, startedAt, pausedAt, duration, countDown };
      });
    },
    [updateElement]
  );

  const handleTimerToggle = useCallback(
    (elementId: string) => {
      writeTimer(elementId, (timer) =>
        timer.startedAt
          ? { startedAt: null, pausedAt: new Date(elapsedMs(timer)).toISOString() }
          : { startedAt: new Date().toISOString() }
      );
    },
    [writeTimer]
  );

  const handleTimerReset = useCallback(
    (elementId: string) => {
      writeTimer(elementId, () => ({
        startedAt: null,
        pausedAt: new Date(0).toISOString(),
        duration: 0,
        countDown: false,
      }));
    },
    [writeTimer]
  );

  const handleTimerUpdate = useCallback(
    (elementId: string, update: { duration?: number; countDown?: boolean }) => {
      writeTimer(elementId, (timer) => {
        const next: Partial<TimerState> = { ...update };
        if (update.countDown === true && !timer.countDown) {
          // Count down from whatever the timer currently shows.
          next.duration = elapsedMs(timer);
          next.pausedAt = new Date(0).toISOString();
          next.startedAt = null;
        } else if (update.countDown === false && timer.countDown) {
          // Count up from whatever time was left.
          const remaining = (timer.duration || 0) - elapsedMs(timer);
          next.pausedAt = new Date(Math.max(0, remaining)).toISOString();
          next.duration = 0;
          next.startedAt = null;
        }
        return next;
      });
    },
    [writeTimer]
  );

  const handleTimerAddTime = useCallback(
    (elementId: string, timeToAdd: number) => {
      writeTimer(elementId, (timer) => {
        if (timer.countDown) {
          return { duration: Math.max(0, (timer.duration || 0) + timeToAdd) };
        }
        const paused = timer.pausedAt ? new Date(timer.pausedAt).getTime() : 0;
        return { pausedAt: new Date(Math.max(0, paused + timeToAdd)).toISOString() };
      });
    },
    [writeTimer]
  );

  const handleDeleteOverlay = async () => {
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
      pendingWrites.current.forEach((write) => clearTimeout(write.timer));
      pendingWrites.current.clear();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  return {
    id,
    overlay,
    setOverlay,
    isLoading,
    error,
    handleOverlayChange,
    handleStructureChange,
    handleCounterChange,
    handleImmediateCounterChange,
    handleTitleChange,
    handleImageChange,
    handleBingoDataChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerUpdate,
    handleTimerAddTime,
    handleDeleteOverlay,
  };
};
