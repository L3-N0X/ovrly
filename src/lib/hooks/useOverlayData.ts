import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PrismaElement, PrismaOverlay } from "@/lib/types";

export const useOverlayData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<PrismaElement | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const fetchOverlay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/overlays/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch overlay");
      }
      const data: PrismaOverlay = await response.json();
      setOverlay(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOverlay();
    }
  }, [id, fetchOverlay]);

  useEffect(() => {
    if (!id) return;

    const wsInstance = new WebSocket(`ws://localhost:3000/ws?overlayId=${id}`);
    setWs(wsInstance);

    wsInstance.onmessage = (event) => {
      try {
        const updatedOverlay: PrismaOverlay = JSON.parse(event.data);
        setOverlay(updatedOverlay);

        if (selectedTimer) {
          const newSelectedTimer = updatedOverlay.elements.find((el) => el.id === selectedTimer.id);
          if (newSelectedTimer) {
            setSelectedTimer(newSelectedTimer);
          }
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    return () => {
      wsInstance.close();
    };
  }, [id, selectedTimer]);

  const debouncedUpdate = useCallback((url: string, body: object) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to update");
        }
      } catch (err) {
        console.error(err);
      }
    }, 500);
  }, []);

  const deepEqual = (obj1: unknown, obj2: unknown): boolean => {
    if (obj1 === obj2) return true;

    if (obj1 && typeof obj1 === 'object' && obj2 && typeof obj2 === 'object') {
      const obj1Rec = obj1 as Record<string, unknown>;
      const obj2Rec = obj2 as Record<string, unknown>;
      if (Object.keys(obj1Rec).length !== Object.keys(obj2Rec).length) return false;

      for (const key in obj1Rec) {
        if (Object.prototype.hasOwnProperty.call(obj1Rec, key)) {
          if (!Object.prototype.hasOwnProperty.call(obj2Rec, key)) return false;
          if (!deepEqual(obj1Rec[key], obj2Rec[key])) return false;
        }
      }
      return true;
    }
    return false;
  };

  const findChangedElements = (
    updatedElements: PrismaElement[],
    originalElements: PrismaElement[]
  ): PrismaElement[] => {
    const changedElements: PrismaElement[] = [];
    const originalMap = new Map<string, PrismaElement>();
    const buildOriginalMap = (elements: PrismaElement[]) => {
      elements.forEach((el) => {
        originalMap.set(el.id, el);
        if (el.children) {
          buildOriginalMap(el.children);
        }
      });
    };
    buildOriginalMap(originalElements);

    const checkElements = (elements: PrismaElement[]) => {
      elements.forEach((el) => {
        const originalEl = originalMap.get(el.id);
        if (!originalEl || !deepEqual(el.style, originalEl.style)) {
          changedElements.push(el);
        }
        if (el.children) {
          checkElements(el.children);
        }
      });
    };
    checkElements(updatedElements);

    return changedElements;
  };

  const handleOverlayChange = (updatedOverlay: PrismaOverlay) => {
    if (!overlay) return;

    if (JSON.stringify(updatedOverlay.globalStyle) !== JSON.stringify(overlay.globalStyle)) {
      debouncedUpdate(`/api/overlays/${id}`, {
        globalStyle: updatedOverlay.globalStyle,
      });
    }

    const changedElements = findChangedElements(updatedOverlay.elements, overlay.elements);

    changedElements.forEach((element) => {
      debouncedUpdate(`/api/elements/${element.id}`, {
        style: element.style,
      });
    });

    setOverlay(updatedOverlay);
  };

  const updateElementById = (
    elements: PrismaElement[],
    id: string,
    updateFn: (el: PrismaElement) => void
  ): boolean => {
    for (const el of elements) {
      if (el.id === id) {
        updateFn(el);
        return true;
      }
      if (el.children) {
        if (updateElementById(el.children, id, updateFn)) {
          return true;
        }
      }
    }
    return false;
  };

  const sendUpdateImmediately = async (elementId: string, data: object) => {
    try {
      await fetch(`/api/elements/${elementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to send immediate update", err);
    }
  };

  const handleCounterChange = (elementId: string, value: number) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.counter) el.counter.value = value;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      debouncedUpdate(`/api/elements/${elementId}`, { data: { value } });
    }
  };

  const handleImmediateCounterChange = (elementId: string, value: number) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.counter) el.counter.value = value;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      sendUpdateImmediately(elementId, { data: { value } });
    }
  };

  const handleTitleChange = (elementId: string, text: string) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.title) el.title.text = text;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      debouncedUpdate(`/api/elements/${elementId}`, { data: { text } });
    }
  };

  const handleImageChange = (elementId: string, src: string) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.image) el.image.src = src;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      sendUpdateImmediately(elementId, { data: { src } });
    }
  };

  const handleTimerToggle = (elementId: string) => {
    const timerElement = overlay?.elements.find((el) => el.id === elementId);
    if (!timerElement?.id || !timerElement.timer) return;
    const { startedAt, pausedAt } = timerElement.timer;

    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      const elapsed = Date.now() - startTime;
      const oldDuration = pausedAt ? new Date(pausedAt).getTime() : 0;
      const newDuration = oldDuration + elapsed;
      sendUpdateImmediately(timerElement.id, {
        data: { startedAt: null, pausedAt: new Date(newDuration).toISOString() },
      });
    } else {
      sendUpdateImmediately(timerElement.id, {
        data: { startedAt: new Date().toISOString(), pausedAt: pausedAt },
      });
    }
  };

  const handleTimerReset = (elementId: string) => {
    const timerElement = overlay?.elements.find((el) => el.id === elementId);
    if (!timerElement?.id) return;
    sendUpdateImmediately(timerElement.id, {
      data: {
        startedAt: null,
        pausedAt: new Date(0).toISOString(),
        duration: 0,
        countDown: false,
      },
    });
  };

  const handleTimerUpdate = (
    elementId: string,
    update: { duration?: number; countDown?: boolean }
  ) => {
    if (!overlay) return;

    const timerElement = overlay.elements.find((el) => el.id === elementId);
    if (!timerElement?.timer) return;

    const updatePayload: {
      duration?: number;
      countDown?: boolean;
      pausedAt?: string;
      startedAt?: string | null;
    } = { ...update };

    const isSwitchingToCountdown = update.countDown === true && !timerElement.timer.countDown;
    const isSwitchingToCountUp = update.countDown === false && timerElement.timer.countDown;

    if (isSwitchingToCountdown) {
      const { startedAt, pausedAt } = timerElement.timer;
      let currentElapsedTime = pausedAt ? new Date(pausedAt).getTime() : 0;
      if (startedAt) {
        currentElapsedTime += Date.now() - new Date(startedAt).getTime();
      }

      updatePayload.duration = currentElapsedTime;
      updatePayload.pausedAt = new Date(0).toISOString();
      updatePayload.startedAt = null;
    } else if (isSwitchingToCountUp) {
      const { startedAt, pausedAt, duration } = timerElement.timer;
      let currentElapsedTime = pausedAt ? new Date(pausedAt).getTime() : 0;
      if (startedAt) {
        currentElapsedTime += Date.now() - new Date(startedAt).getTime();
      }

      const remainingTime = (duration || 0) - currentElapsedTime;

      updatePayload.pausedAt = new Date(remainingTime > 0 ? remainingTime : 0).toISOString();
      updatePayload.duration = 0;
      updatePayload.startedAt = null;
    }

    const newOverlay = JSON.parse(JSON.stringify(overlay));
    updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.timer) {
        if (updatePayload.countDown !== undefined) el.timer.countDown = updatePayload.countDown;
        if (updatePayload.duration !== undefined) el.timer.duration = updatePayload.duration;
        if (updatePayload.pausedAt !== undefined) el.timer.pausedAt = updatePayload.pausedAt;
        if (updatePayload.startedAt !== undefined) el.timer.startedAt = updatePayload.startedAt;
        else if (updatePayload.startedAt === null) el.timer.startedAt = null;
      }
    });
    setOverlay(newOverlay);

    sendUpdateImmediately(elementId, { data: updatePayload });
  };

  const handleTimerAddTime = (elementId: string, timeToAdd: number) => {
    if (!overlay) return;
    const timerElement = overlay.elements.find((el) => el.id === elementId);
    if (!timerElement?.timer) return;

    const { pausedAt, duration, countDown } = timerElement.timer;
    const updatePayload: {
      duration?: number;
      pausedAt?: string;
    } = {};

    if (countDown) {
      const newDuration = (duration || 0) + timeToAdd;
      updatePayload.duration = newDuration > 0 ? newDuration : 0;
    } else {
      const oldPausedDuration = pausedAt ? new Date(pausedAt).getTime() : 0;
      const newPausedDuration = oldPausedDuration + timeToAdd;
      updatePayload.pausedAt = new Date(
        newPausedDuration > 0 ? newPausedDuration : 0
      ).toISOString();
    }

    const newOverlay = JSON.parse(JSON.stringify(overlay));
    updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.timer) {
        Object.assign(el.timer, updatePayload);
      }
    });
    setOverlay(newOverlay);

    sendUpdateImmediately(elementId, { data: updatePayload });
  };

  const handleDeleteOverlay = async () => {
    try {
      await fetch(`/api/overlays/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
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
    ws,
  };
};
