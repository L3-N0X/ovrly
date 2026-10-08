import { useCallback, useEffect, useRef, useState } from "react";

// A Twitch stream shown behind the canvas in the editor only, so an overlay that covers the
// whole stream frame can be lined up with what is actually on stream. Nothing of it is saved
// with the overlay: the settings are kept in this browser, per overlay.

export type StreamPreviewSource = "live" | "still";

export interface StreamPreviewSettings {
  enabled: boolean;
  // A Twitch login name. Null follows the overlay owner's channel.
  channel: string | null;
  source: StreamPreviewSource;
  // 0 to 100.
  opacity: number;
}

const DEFAULT_SETTINGS: StreamPreviewSettings = {
  enabled: false,
  channel: null,
  source: "live",
  opacity: 100,
};

// How often the still frame is fetched again. Twitch renews it every few minutes at most.
const STILL_REFRESH_MS = 60_000;

const storageKey = (overlayId: string) => `ovrly:stream-preview:${overlayId}`;

const loadSettings = (overlayId: string): StreamPreviewSettings => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(overlayId)) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS;
    const { enabled, channel, source, opacity } = stored as Partial<StreamPreviewSettings>;
    return {
      enabled: enabled === true,
      channel: typeof channel === "string" ? normalizeChannel(channel) : null,
      source: source === "still" ? "still" : "live",
      opacity: typeof opacity === "number" ? Math.min(Math.max(opacity, 0), 100) : 100,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

/**
 * A Twitch login from whatever was typed or pasted: a name, "@name" or a channel URL. Null
 * when it can't be one.
 */
export const normalizeChannel = (input: string): string | null => {
  const login = input
    .trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?twitch\.tv\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return /^[a-z0-9_]{1,25}$/.test(login) ? login : null;
};

export type StillFrame =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "error" }
  | { status: "ready"; url: string; fetchedAt: Date };

// Twitch's preview image of a live channel, fetched again every minute. For a channel that
// isn't live Twitch redirects to a placeholder, which is reported as offline instead of shown.
const useStillFrame = (channel: string | null, active: boolean) => {
  // The latest answer and the channel it is for; one for another channel counts as loading.
  const [result, setResult] = useState<{
    channel: string;
    frame: StillFrame;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!channel || !active) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const show = (frame: StillFrame) => {
      if (!cancelled) setResult({ channel, frame });
    };

    const load = async () => {
      try {
        const response = await fetch(
          `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-1920x1080.jpg?t=${Date.now()}`,
          { redirect: "manual", cache: "no-store" }
        );
        if (response.type === "opaqueredirect") return show({ status: "offline" });
        if (!response.ok) return show({ status: "error" });
        const blob = await response.blob();
        if (cancelled) return;
        // The previous frame stays up until the next one is there, so refreshing doesn't flash.
        const previous = objectUrl;
        objectUrl = URL.createObjectURL(blob);
        show({ status: "ready", url: objectUrl, fetchedAt: new Date() });
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        show({ status: "error" });
      }
    };

    loadRef.current = load;
    void load();
    const interval = window.setInterval(load, STILL_REFRESH_MS);
    return () => {
      cancelled = true;
      loadRef.current = null;
      window.clearInterval(interval);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      // Its image is gone now, so turning the preview back on starts over.
      setResult(null);
    };
  }, [channel, active]);

  const refresh = useCallback(async () => {
    if (!loadRef.current) return;
    setRefreshing(true);
    await loadRef.current();
    setRefreshing(false);
  }, []);

  const frame: StillFrame =
    result && result.channel === channel ? result.frame : { status: "loading" };
  return { frame, refreshing, refresh };
};

// Everything the toolbar button and the backdrop share. `defaultChannel` is the overlay
// owner's Twitch name, used until another channel is picked.
export const useStreamPreview = (overlayId: string, defaultChannel: string | null) => {
  const [settings, setSettings] = useState(() => loadSettings(overlayId));

  const update = useCallback(
    (patch: Partial<StreamPreviewSettings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        try {
          localStorage.setItem(storageKey(overlayId), JSON.stringify(next));
        } catch {
          // Storage is unavailable; the settings still last for this page.
        }
        return next;
      }),
    [overlayId]
  );

  const ownerChannel = defaultChannel ? normalizeChannel(defaultChannel) : null;
  const channel = settings.channel ?? ownerChannel;
  const showing = settings.enabled && !!channel;
  const still = useStillFrame(channel, showing && settings.source === "still");

  return { settings, update, ownerChannel, channel, showing, still };
};

export type StreamPreview = ReturnType<typeof useStreamPreview>;
