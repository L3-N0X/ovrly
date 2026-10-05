import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PrismaElement, PrismaOverlay } from "@/lib/types";
import { connectOverlaySocket } from "@/lib/overlaySocket";

const DEBOUNCE_MS = 500;

type TimerState = NonNullable<PrismaElement["timer"]>;

// One queued write per field (an element's style, a counter's value, ...). Writes to the same
// field are coalesced and sent one at a time, so the latest value always lands last; writes
// to different fields don't interfere with each other.
interface PendingWrite {
  url: string;
  body: object;
  // Re-applies the local value on top of server state that doesn't include it yet.
  apply: (overlay: PrismaOverlay) => void;
  version: number;
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  resend: boolean;
}

const findElement = (overlay: PrismaOverlay, elementId: string) =>
  overlay.elements.find((el) => el.id === elementId);

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
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);

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
      write.resend = false;
      const { url, body, version } = write;
      let failed = false;
      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });
        if (!response.ok) throw new Error(`Failed to update (${response.status})`);
      } catch (err) {
        console.error(err);
        failed = true;
      }
      write.inFlight = false;

      if (write.resend) {
        sendWrite(key);
        return;
      }
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
      url: string,
      body: object,
      apply: (overlay: PrismaOverlay) => void,
      delay = 0
    ) => {
      const write: PendingWrite = pendingWrites.current.get(key) ?? {
        url,
        body,
        apply,
        version: 0,
        inFlight: false,
        resend: false,
      };
      Object.assign(write, { url, body, apply, version: ++writeVersion.current });
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
      queueWrite(`${elementId}:${field}`, `/api/elements/${elementId}`, body, apply, delay);
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
          method: "PATCH",
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

  // Persists whatever changed between the current overlay and `updatedOverlay` (global
  // style and element styles) and adopts `updatedOverlay` as the new local state.
  const handleOverlayChange = useCallback(
    (updatedOverlay: PrismaOverlay) => {
      const current = overlayRef.current;
      if (!current) return;

      if (!isEqual(updatedOverlay.globalStyle, current.globalStyle)) {
        const globalStyle = updatedOverlay.globalStyle;
        queueWrite(
          "overlay:globalStyle",
          `/api/overlays/${current.id}`,
          { globalStyle },
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
          `/api/elements/${element.id}`,
          { style },
          (target) => {
            const el = findElement(target, element.id);
            if (el) el.style = style;
          },
          DEBOUNCE_MS
        );
      }

      setOverlay(updatedOverlay);
    },
    [queueWrite, setOverlay]
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

  // Derived from the overlay so the timer modal always shows the current timer state.
  const selectedTimer =
    (selectedTimerId && overlay && findElement(overlay, selectedTimerId)) || null;
  const setSelectedTimer = useCallback((timer: PrismaElement | null) => {
    setSelectedTimerId(timer?.id ?? null);
  }, []);

  return {
    id,
    overlay,
    setOverlay,
    isLoading,
    error,
    handleOverlayChange,
    handleCounterChange,
    handleImmediateCounterChange,
    handleTitleChange,
    handleImageChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerUpdate,
    handleTimerAddTime,
    handleDeleteOverlay,
    selectedTimer,
    setSelectedTimer,
  };
};
