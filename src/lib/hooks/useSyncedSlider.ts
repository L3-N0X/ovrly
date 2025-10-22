import { useState, useEffect, useCallback, useRef } from "react";
import { debounce } from "@/lib/utils";

interface SyncedSliderOptions {
  debounceMs?: number;
  ignoreWindowMs?: number;
}

export const useSyncedSlider = (
  key: string,
  initialValue: number,
  ws: WebSocket | null,
  options: SyncedSliderOptions = {}
) => {
  const { debounceMs = 400, ignoreWindowMs = 500 } = options;

  const [uiValue, setUiValue] = useState(initialValue);
  const isDragging = useRef(false);
  const lastSentTime = useRef(0);

  // Effect to update UI value when initialValue changes from props, but only if not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setUiValue(initialValue);
    }
  }, [initialValue]);

  // Debounced WebSocket sender
  const sendToWs = useCallback(
    debounce((value: number) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ key, value }));
        lastSentTime.current = Date.now();
      }
    }, debounceMs),
    [ws, key, debounceMs]
  );

  // Handle slider interaction
  const handleChange = (newValue: number) => {
    setUiValue(newValue); // Update UI immediately
    sendToWs(newValue); // Debounced send
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
    onChange: handleChange,
    onMouseDown: () => (isDragging.current = true),
    onMouseUp: () => (isDragging.current = false),
    onTouchStart: () => (isDragging.current = true),
    onTouchEnd: () => (isDragging.current = false),
  };
};
