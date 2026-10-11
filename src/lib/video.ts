import type { PrismaElement, VideoStyle } from "./types";

// Mirrors lib/video.ts on the server, which applies the same actions to the stored video. Here
// they only update the editor right away, until the server's result arrives. The rest works out
// where in the video it is, the same way in the editor, the controls and OBS.

export type VideoState = NonNullable<PrismaElement["video"]>;

export type VideoAction =
  | { type: "play" }
  | { type: "pause" }
  // Plays it from the start.
  | { type: "restart" }
  // Back to the start, paused.
  | { type: "stop" };

export const DEFAULT_VIDEO_VOLUME = 100;

const iso = (ms: number) => new Date(ms).toISOString();

// Where it is at `now`, in seconds since the start: not wrapped around its length, which only
// the loaded video knows (see videoTime).
export const videoPosition = (video: Pick<VideoState, "position" | "startedAt">, now: number) =>
  video.position +
  (video.startedAt ? Math.max(0, now - new Date(video.startedAt).getTime()) / 1000 : 0);

export const applyVideoAction = (video: VideoState, action: VideoAction, now: number): VideoState => {
  switch (action.type) {
    case "play":
      return video.startedAt ? video : { ...video, startedAt: iso(now) };
    case "pause":
      return video.startedAt ? { ...video, position: videoPosition(video, now), startedAt: null } : video;
    case "restart":
      return { ...video, position: 0, startedAt: iso(now) };
    case "stop":
      return { ...video, position: 0, startedAt: null };
  }
};

// A new video starts from the beginning, playing if the old one was.
export const withNewSource = (video: VideoState, src: string, now: number): VideoState => ({
  ...video,
  src,
  position: 0,
  startedAt: video.startedAt ? iso(now) : null,
});

export const videoLoops = (style: VideoStyle | null | undefined) => style?.loop !== false;

// The moment of a video of `duration` seconds (null while that isn't known yet) it shows at
// `now`: wrapped around when it loops, else held on the last frame once it `ended`.
export const videoTime = (
  video: Pick<VideoState, "position" | "startedAt">,
  duration: number | null,
  loop: boolean,
  now: number
) => {
  const position = videoPosition(video, now);
  if (duration === null || !Number.isFinite(duration) || duration <= 0) {
    return { time: position, ended: false };
  }
  if (loop) return { time: position % duration, ended: false };
  return { time: Math.min(position, duration), ended: position >= duration };
};

// Files a browser draws as images, GIFs and animated WebP or PNG included. These are shown with
// an <img>, which plays them by itself; anything else is taken for a video.
const IMAGE_EXTENSIONS = /\.(gif|webp|png|apng|avif|jpe?g|svg)$/i;

export const isImageSrc = (src: string) => {
  try {
    return IMAGE_EXTENSIONS.test(new URL(src, window.location.href).pathname);
  } catch {
    return false;
  }
};

// What the file inputs of video elements take: the videos the server accepts, and images for GIFs.
export const VIDEO_FILE_TYPES = "video/mp4,video/webm,image/gif,image/webp,image/png";
