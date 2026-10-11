import React, { useEffect, useRef, useState } from "react";
import type { PrismaElement, VideoStyle } from "@/lib/types";
import { DEFAULT_VIDEO_VOLUME, isImageSrc, videoLoops, videoTime } from "@/lib/video";
import { useCanvasEditing } from "./canvasEditing";
import { useFill } from "./fill";
import { useOverlayAudio } from "./overlayAudio";
import { useElementResize } from "./useElementResize";

const MIN_VIDEO_SIZE = 8;
// How far (in seconds) a video may be from where it should be before it is moved there. Seeking
// stutters, so playback that is only a little off is left alone.
const SYNC_TOLERANCE = 0.3;

type MediaKind = "video" | "image";

interface VideoProps {
  element: PrismaElement;
}

// A video, or an animated image (GIF, WebP) drawn with an <img>, which plays it by itself and can
// only be shown or hidden. Videos follow the stored playback (src/lib/video.ts), so the editor,
// the controls and OBS are at the same moment: seeked there whenever it changes, and left to play
// on their own in between. WebM with an alpha channel is drawn with its transparency.
const Video: React.FC<VideoProps> = ({ element }) => {
  const { video, style } = element;
  const videoStyle = style as VideoStyle | null;
  const editing = useCanvasEditing();
  const audio = useOverlayAudio();
  const fill = useFill(element);
  const { dragSize, handle } = useElementResize(element, MIN_VIDEO_SIZE, {
    width: !fill.width,
    height: !fill.height,
  });
  const mediaRef = useRef<HTMLVideoElement>(null);
  const src = video?.src ?? "";
  const loop = videoLoops(videoStyle);
  const playing = !!video?.startedAt;

  // A link that doesn't play as a video is tried as an image and the other way round; one that
  // loads as neither is drawn like no video at all, rather than as the browser's broken media.
  const [failed, setFailed] = useState<{ src: string; kinds: MediaKind[] }>({ src: "", kinds: [] });
  const failedKinds = failed.src === src ? failed.kinds : [];
  const order: MediaKind[] = isImageSrc(src) ? ["image", "video"] : ["video", "image"];
  const kind = src ? (order.find((k) => !failedKinds.includes(k)) ?? null) : null;
  const fail = (failedKind: MediaKind) =>
    setFailed((current) => ({
      src,
      kinds: [...(current.src === src ? current.kinds : []), failedKind],
    }));

  // The length of the video playing, once it is known.
  const [meta, setMeta] = useState<{ src: string; duration: number } | null>(null);
  const duration = meta?.src === src && Number.isFinite(meta.duration) ? meta.duration : null;
  const readDuration = (e: React.SyntheticEvent<HTMLVideoElement>) =>
    setMeta({ src, duration: e.currentTarget.duration });

  // `now` only moves on when a video that doesn't loop is due to end, so it may be older than
  // the state: a video played since then counts as having just started.
  const [now, setNow] = useState(() => Date.now());
  const { ended } = video ? videoTime(video, duration, loop, now) : { ended: false };
  const endsAt =
    video?.startedAt && !loop && duration !== null && !ended
      ? new Date(video.startedAt).getTime() + (duration - video.position) * 1000
      : null;
  useEffect(() => {
    if (endsAt === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [endsAt]);

  // Set before it is played (effects run in order), so it starts with sound where it may. A
  // browser that won't play sound before the page was clicked plays it muted, and it stays so.
  const soundBlocked = useRef(false);
  const muted = !audio || videoStyle?.muted === true;
  const volume = Math.min(100, Math.max(0, videoStyle?.volume ?? DEFAULT_VIDEO_VOLUME)) / 100;
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = muted || soundBlocked.current;
    media.volume = Number.isFinite(volume) ? volume : 1;
  }, [kind, src, muted, volume]);

  // Moves the video to where the stored playback says it is, and plays or pauses it.
  const position = video?.position ?? 0;
  const startedAt = video?.startedAt ?? null;
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || kind !== "video") return;
    const target = videoTime({ position, startedAt }, duration, loop, Date.now());
    if (duration !== null && Math.abs(media.currentTime - target.time) > SYNC_TOLERANCE) {
      media.currentTime = target.time;
    }
    if (startedAt && !target.ended) {
      // Also rejected (AbortError) when a pause or a new source comes first, which is fine.
      media.play().catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name !== "NotAllowedError" || media.muted) return;
        soundBlocked.current = true;
        media.muted = true;
        media.play().catch(() => {});
      });
    } else {
      media.pause();
    }
  }, [kind, src, position, startedAt, duration, loop]);

  // Hidden while it doesn't play, if it should be: it keeps its place in the layout, and the
  // editor outlines it like an empty one, so it can still be found and picked.
  const hidden = videoStyle?.hideWhenStopped === true && (!playing || ended);
  const shown = kind !== null && !hidden;
  // Without a stored size it is drawn at its own, and an empty one at 100 pixels.
  const width = dragSize?.width ?? videoStyle?.width ?? (kind ? undefined : 100);
  const height = dragSize?.height ?? videoStyle?.height ?? (kind ? undefined : 100);

  const mediaStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: videoStyle?.objectFit || "cover",
    borderRadius: videoStyle?.borderRadius ? `${videoStyle.borderRadius}px` : "0px",
    visibility: shown ? undefined : "hidden",
  };

  return (
    <div
      style={{
        position: "relative",
        width: width !== undefined ? `${width}px` : undefined,
        height: height !== undefined ? `${height}px` : undefined,
        flexShrink: 0,
        ...fill.style,
      }}
      className={
        !shown && editing ? "outline-1 -outline-offset-1 outline-dashed outline-white/40" : undefined
      }
    >
      {kind === "video" && (
        <video
          // A new source is a new video, with its own length and playback.
          key={src}
          ref={mediaRef}
          src={src}
          loop={loop}
          playsInline
          preload="auto"
          disablePictureInPicture
          onLoadedMetadata={readDuration}
          onDurationChange={readDuration}
          onEnded={() => setNow(Date.now())}
          onError={() => fail("video")}
          style={mediaStyle}
        />
      )}
      {kind === "image" && (
        <img key={src} src={src} alt={element.name} onError={() => fail("image")} style={mediaStyle} />
      )}
      {handle}
    </div>
  );
};

export default Video;
