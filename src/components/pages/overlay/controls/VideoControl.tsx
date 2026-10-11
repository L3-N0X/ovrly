import React, { useEffect, useRef, useState } from "react";
import { Clapperboard, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BindableField } from "@/components/variables/BindableField";
import { formatDuration } from "@/lib/duration";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import type { PrismaElement, VideoStyle } from "@/lib/types";
import { uploadFile } from "@/lib/uploads";
import {
  isImageSrc,
  VIDEO_FILE_TYPES,
  videoLoops,
  videoTime,
  type VideoAction,
} from "@/lib/video";
import TimeReadout from "./TimeReadout";

interface VideoControlProps {
  element: PrismaElement;
  onVideoChange: (elementId: string, src: string) => void;
  onAction: (elementId: string, action: VideoAction) => void;
}

const formatTime = (seconds: number, longest: number) =>
  formatDuration(seconds * 1000, longest >= 3600 ? "H:mm:ss" : "m:ss");

// What a video shows (an upload or a link) and where it is: playing, pausing, playing it again
// from the start, or stopping it. The same moment is shown in the editor and in OBS.
const VideoControl: React.FC<VideoControlProps> = ({ element, onVideoChange, onAction }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = element.video;
  const src = video?.src ?? "";
  const style = element.style as VideoStyle | null;
  const loop = videoLoops(style);
  const isImage = !!src && isImageSrc(src);
  const playing = !!video?.startedAt;

  // The link being typed, sent once it is done.
  const { value: link, setValue: setLink } = useLocalCopy(src);
  const commitLink = () => {
    const next = link.trim();
    if (next !== src) onVideoChange(element.id, next);
  };

  // Read from the thumbnail, which loads the video's metadata anyway.
  const [meta, setMeta] = useState<{ src: string; duration: number } | null>(null);
  const duration = meta?.src === src && Number.isFinite(meta.duration) ? meta.duration : null;

  // Ticks while it plays, for the time shown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [playing]);
  const { time, ended } = video
    ? videoTime(video, duration, loop, now)
    : { time: 0, ended: false };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onVideoChange(element.id, await uploadFile(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload the file");
    } finally {
      setUploading(false);
    }
  };

  // An ended video (one that doesn't loop) plays again from the start.
  const togglePlay = () =>
    onAction(element.id, { type: playing && !ended ? "pause" : ended ? "restart" : "play" });

  return (
    <div className="space-y-3">
      <BindableField property="src" label="Video">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {src && !isImage ? (
              <video
                key={src}
                src={src}
                muted
                preload="metadata"
                onLoadedMetadata={(e) => setMeta({ src, duration: e.currentTarget.duration })}
                className="size-9 shrink-0 rounded-md bg-secondary object-cover"
              />
            ) : src ? (
              <img
                src={src}
                alt={element.name}
                className="size-9 shrink-0 rounded-md bg-secondary object-cover"
              />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Clapperboard className="size-4 text-muted-foreground" />
              </div>
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={src || undefined}>
              {src.replace(/^.*[\\/]/, "") || "No video yet"}
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : src ? "Change" : "Upload"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept={VIDEO_FILE_TYPES}
            />
          </div>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={commitLink}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Or paste a link to a video or GIF"
            aria-label="Video link"
            className="h-8 text-xs"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </BindableField>
      <div className="flex items-center gap-1.5">
        <TimeReadout
          value={
            !playing && time === 0
              ? "Stopped"
              : duration !== null
                ? `${formatTime(time, duration)} / ${formatTime(duration, duration)}`
                : formatTime(time, time)
          }
        />
        <Button
          onClick={togglePlay}
          title={playing && !ended ? "Pause" : ended ? "Play again" : "Play"}
          size="icon"
          variant="secondary"
        >
          {playing && !ended ? <Pause /> : <Play />}
        </Button>
        <Button
          onClick={() => onAction(element.id, { type: "restart" })}
          title="Play from the start"
          size="icon"
          variant="secondary"
        >
          <RotateCcw />
        </Button>
        <Button
          onClick={() => onAction(element.id, { type: "stop" })}
          title="Stop"
          size="icon"
          variant="secondary"
          disabled={!playing && time === 0}
        >
          <Square />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isImage
          ? "GIFs and other animated images always play; pausing or stopping only hides them when they are set to hide while not playing."
          : ended
            ? "It has ended. Play it again from the start, or turn on looping."
            : "Use WebM (VP9) for videos with a transparent background; MP4 has none."}
      </p>
    </div>
  );
};

export default VideoControl;
