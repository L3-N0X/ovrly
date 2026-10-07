import React, { useState } from "react";
import { Image as ImageIcon, MonitorPlay, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  normalizeChannel,
  type StillFrame,
  type StreamPreview,
  type StreamPreviewSource,
} from "./useStreamPreview";

// The stream itself, sized to the canvas (letterboxed if the canvas isn't 16:9). Never takes
// pointer events, so clicks still reach the canvas and its elements.
export const StreamBackdrop = React.memo(
  ({
    channel,
    source,
    opacity,
    stillFrame,
  }: {
    channel: string;
    source: StreamPreviewSource;
    opacity: number;
    stillFrame: StillFrame;
  }) => {
    const message =
      source === "still" && stillFrame.status !== "ready"
        ? {
            loading: `Loading ${channel}'s stream…`,
            offline: `${channel} isn't live right now`,
            error: `Couldn't load ${channel}'s stream`,
          }[stillFrame.status]
        : null;

    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
          {source === "live" ? (
            <iframe
              // Muted, or browsers won't start it on their own.
              src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=true&autoplay=true`}
              title={`${channel}'s stream`}
              allow="autoplay"
              tabIndex={-1}
              className="size-full border-0"
            />
          ) : (
            stillFrame.status === "ready" && (
              <img src={stillFrame.url} alt="" className="size-full object-contain" />
            )
          )}
        </div>
        {message && (
          <div
            className="absolute inset-0 flex items-center justify-center text-neutral-500"
            // Stays readable at any zoom.
            style={{ fontSize: "calc(14px / var(--canvas-zoom))" }}
          >
            {message}
          </div>
        )}
      </div>
    );
  }
);

const SOURCES: readonly SegmentedOption<StreamPreviewSource>[] = [
  { value: "live", label: "Live" },
  { value: "still", label: "Still frame" },
];

// The toolbar button and its settings. The backdrop itself is drawn by the canvas.
export const StreamPreviewButton: React.FC<{ preview: StreamPreview }> = ({ preview }) => {
  const { settings, update, ownerChannel, channel, showing, still } = preview;
  const stillFrame = still.frame;
  // What is being typed into the channel field; null while it shows the current channel.
  const [draft, setDraft] = useState<string | null>(null);

  const draftChannel = draft === null ? channel : normalizeChannel(draft);
  const draftInvalid = draft !== null && draft.trim() !== "" && !draftChannel;

  const commitDraft = () => {
    if (draft === null) return;
    if (draft.trim() === "") update({ channel: null });
    else if (draftChannel) {
      // The owner's channel is stored as "follow the owner", so it keeps up with renames.
      update({
        channel: draftChannel === ownerChannel ? null : draftChannel,
        enabled: true,
      });
    } else return;
    setDraft(null);
  };

  const status =
    settings.source === "live"
      ? "Plays the stream muted, a few seconds behind. Twitch draws its player controls on top at times; the still frame has none."
      : stillFrame.status === "ready"
        ? `Twitch's preview image, without player controls. Updated ${stillFrame.fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}; Twitch renews it every few minutes.`
        : stillFrame.status === "offline"
          ? "The channel isn't live, so Twitch has no frame to show."
          : stillFrame.status === "error"
            ? "Twitch didn't answer. Try again in a moment."
            : "Twitch's preview image, without player controls. Twitch renews it every few minutes.";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Stream preview"
          aria-label="Stream preview"
          aria-pressed={showing}
          className={cn(showing && "bg-accent text-accent-foreground dark:bg-accent/50")}
        >
          <MonitorPlay />
          <span className="hidden md:inline">Stream</span>
          {showing && <span className="size-1.5 rounded-full bg-red-500" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="stream-preview-enabled">Stream preview</Label>
            <p className="text-xs text-muted-foreground">
              Shows a Twitch stream behind the canvas, here in the editor only, to line elements up
              with what's on stream. Works best when the canvas matches the stream's size.
            </p>
          </div>
          <Switch
            id="stream-preview-enabled"
            checked={showing}
            disabled={!channel}
            onCheckedChange={(enabled) => update({ enabled })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stream-preview-channel">Channel</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              twitch.tv/
            </span>
            <Input
              id="stream-preview-channel"
              value={draft ?? channel ?? ""}
              placeholder="channel"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={draftInvalid || undefined}
              className="pl-[4.6rem]"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraft();
              }}
            />
          </div>
          {draftInvalid && (
            <p className="text-xs text-destructive">
              Twitch names only use letters, numbers and underscores.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stream-preview-source">Show</Label>
          <div className="flex items-center gap-2">
            <SegmentedControl
              id="stream-preview-source"
              value={settings.source}
              onValueChange={(source) => update({ source })}
              options={SOURCES}
            />
            {settings.source === "still" && showing && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Fetch the frame again"
                aria-label="Fetch the frame again"
                disabled={still.refreshing}
                onClick={() => void still.refresh()}
              >
                <RefreshCw
                  className={cn(
                    (still.refreshing || stillFrame.status === "loading") && "animate-spin"
                  )}
                />
              </Button>
            )}
          </div>
          <p className="flex gap-1.5 text-xs text-muted-foreground">
            {settings.source === "live" ? (
              <Radio className="mt-px size-3.5 shrink-0" />
            ) : (
              <ImageIcon className="mt-px size-3.5 shrink-0" />
            )}
            {status}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stream-preview-opacity">Opacity</Label>
          <NumberField
            id="stream-preview-opacity"
            value={settings.opacity}
            min={0}
            max={100}
            unit="%"
            progress
            onChange={(opacity) => update({ opacity })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
