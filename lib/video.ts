// Videos play like a tape (Video in prisma/schema.prisma): from `position` seconds on since
// `startedAt`, or held at `position` while paused. Like timers, they are changed through actions
// the server applies to the state it actually has, with its own clock, so the editor, the
// controls and OBS all show the same moment. Mirrored by src/lib/video.ts, which also works out
// where in the video that is.

export interface VideoState {
  position: number;
  // When it was played from `position`; null while paused.
  startedAt: Date | null;
}

// Pausing needs no position: the server works it out from when it was played. It may be past
// the end, or many loops in; clients wrap or clamp it, since only they know the video's length.
export type VideoAction =
  | { type: "play" }
  | { type: "pause" }
  // Plays it from the start.
  | { type: "restart" }
  // Back to the start, paused.
  | { type: "stop" };

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;
// The longest URL a video can have, like an image variable's.
export const MAX_VIDEO_SRC_LENGTH = 2048;

// Where it is at `now`, in seconds since the start (not wrapped around its length).
export const videoPosition = (video: VideoState, now: number) =>
  video.position + (video.startedAt ? Math.max(0, now - video.startedAt.getTime()) / 1000 : 0);

export const applyVideoAction = (video: VideoState, action: VideoAction, now: number): VideoState => {
  switch (action.type) {
    case "play":
      return video.startedAt ? video : { ...video, startedAt: new Date(now) };
    case "pause":
      return video.startedAt ? { position: videoPosition(video, now), startedAt: null } : video;
    case "restart":
      return { position: 0, startedAt: new Date(now) };
    case "stop":
      return { position: 0, startedAt: null };
  }
};

// A new video starts from the beginning, playing if the old one was.
export const withNewSource = (video: VideoState, now: number): VideoState => ({
  position: 0,
  startedAt: video.startedAt ? new Date(now) : null,
});

export const isVideoSrc = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_VIDEO_SRC_LENGTH;

const VIDEO_ACTION_TYPES = new Set(["play", "pause", "restart", "stop"]);

export const parseVideoActions = (value: unknown): VideoAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map((action) => {
    const type = (action as { type?: unknown } | null)?.type;
    return typeof type === "string" && VIDEO_ACTION_TYPES.has(type) ? ({ type } as VideoAction) : null;
  });
  return actions.every((action) => action !== null) ? (actions as VideoAction[]) : null;
};

// The video of an element copied from presets, imports and duplicates, which may be user
// supplied: only its source is taken over, and the copy plays from the start.
export const videoSeed = (value: unknown) => {
  const src = (value && typeof value === "object" ? value : {}) as { src?: unknown };
  return { src: isVideoSrc(src.src) ? src.src : "" };
};
