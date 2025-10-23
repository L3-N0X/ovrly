import { useState, useEffect, useRef } from "react";

interface SyncedSliderOptions {
  onCommit?: (value: number) => void;
  ignoreWindowMs?: number;
}

export const useSyncedSlider = (
  key: string,
  initialValue: number,
  ws: WebSocket | null,
  options: SyncedSliderOptions = {}
) => {
  const { onCommit, ignoreWindowMs = 500 } = options;

  const [uiValue, setUiValue] = useState(initialValue);
  const isDragging = useRef(false);
  const lastSentTime = useRef(0);

  // Effect to update UI value when initialValue changes from props, but only if not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setUiValue(initialValue);
    }
  }, [initialValue]);

  const sendToWs = (value: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ key, value }));
      lastSentTime.current = Date.now();
    }
  };

  const handleInteractionEnd = () => {
    isDragging.current = false;
    if (onCommit) {
      onCommit(uiValue);
    }
    sendToWs(uiValue);
  };

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.key !== key) return;

        // Ignore if we just sent something
        const timeSinceLastSend = Date.now() - lastSentTime.current;
        if (timeSinceLastSend < ignoreWindowMs) return;

        // Only update if not dragging
        if (!isDragging.current) {
          setUiValue(data.value);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, key, ignoreWindowMs]);

  return {
    value: uiValue,
    onChange: setUiValue,
    onMouseDown: () => {
      isDragging.current = true;
    },
    onMouseUp: handleInteractionEnd,
    onTouchStart: () => {
      isDragging.current = true;
    },
    onTouchEnd: handleInteractionEnd,
  };
};