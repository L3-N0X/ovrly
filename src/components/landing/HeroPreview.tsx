import { cn } from "@/lib/utils";
import {
  Clock,
  Folder,
  Hash,
  MessageSquare,
  Music,
  Type,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useState } from "react";

// A make-believe editor with a "Starting soon" scene that runs by itself: the countdown
// ticks, followers trickle in and chat moves. Only a picture, nothing in it is clickable.

const CHAT = [
  { name: "pixelpanda", color: "#ff7ab6", text: "hype!! 🎉" },
  { name: "modbot", color: "#7dd3fc", text: "Stream starts soon, grab a drink" },
  { name: "lunarfox", color: "#fbbf24", text: "that countdown font is so clean" },
  { name: "kiwi_dev", color: "#86efac", text: "first time here, hi chat 👋" },
  { name: "nightowl", color: "#c4b5fd", text: "the overlay updates live?? wild" },
  { name: "bytebard", color: "#fda4af", text: "let's goooo" },
];

const LAYERS: { icon: LucideIcon; name: string; depth?: number; selected?: boolean }[] = [
  { icon: Type, name: "Title" },
  { icon: Clock, name: "Countdown", selected: true },
  { icon: Hash, name: "Follower goal" },
  { icon: Folder, name: "Now playing" },
  { icon: Music, name: "Track", depth: 1 },
  { icon: Type, name: "Artist", depth: 1 },
  { icon: MessageSquare, name: "Chat" },
];

const START_SECONDS = 4 * 60 + 59;
const GOAL = 1000;

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export const HeroPreview: React.FC = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = START_SECONDS - (tick % (START_SECONDS + 1));
  // A follower every few seconds, starting close enough to the goal to see it move.
  const followers = Math.min(GOAL, 912 + Math.floor(tick / 3) + Math.floor(tick / 7));
  const chat = Array.from({ length: 4 }, (_, i) => {
    const index = Math.floor(tick / 2) + i;
    return { ...CHAT[index % CHAT.length], key: index };
  });
  const songProgress = (tick % 214) / 214;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl ring-1 ring-foreground/5">
      {/* Window bar */}
      <div className="flex h-10 items-center gap-3 border-b px-4">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md border bg-background/60 px-3 py-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Starting soon</span>
          <span className="hidden sm:inline">· Editor</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      <div className="flex">
        {/* Layers */}
        <aside className="hidden w-44 shrink-0 border-r p-2 text-xs md:block">
          <p className="px-2 pt-1 pb-2 font-medium text-muted-foreground">Layers</p>
          {LAYERS.map(({ icon: Icon, name, depth, selected }) => (
            <div
              key={name}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5",
                selected ? "bg-primary/15 text-primary" : "text-muted-foreground"
              )}
              style={{ paddingLeft: depth ? `${0.5 + depth}rem` : undefined }}
            >
              <Icon className="size-3.5 shrink-0" />
              {name}
            </div>
          ))}
        </aside>

        {/* Canvas */}
        <div className="flex-1 bg-pasteboard p-3 sm:p-6">
          <div
            className="@container relative aspect-video overflow-hidden rounded-md shadow-lg"
            style={{
              background:
                "radial-gradient(60% 80% at 15% 10%, #3b1d7a 0%, transparent 60%), radial-gradient(50% 70% at 90% 90%, #7a1d5c 0%, transparent 60%), #0c0a14",
            }}
          >
            {/* Title */}
            <div className="absolute top-[9%] left-[6%] font-display leading-none text-white">
              <p className="text-[2.2cqw] font-medium tracking-[0.3em] text-white/60">
                THE STREAM IS
              </p>
              <p className="mt-[0.6cqw] text-[6cqw] font-bold tracking-tight">Starting soon</p>
            </div>

            {/* Countdown, selected */}
            <div className="absolute top-[38%] left-[6%]">
              <div className="relative px-[1cqw] font-display text-[11cqw] leading-none font-bold text-white tabular-nums">
                {formatTime(remaining)}
                <div className="pointer-events-none absolute -inset-[0.4cqw] border-[1.5px] border-primary">
                  <span className="absolute -top-[2.6cqw] left-0 rounded-sm bg-primary px-[0.8cqw] py-[0.2cqw] font-sans text-[1.3cqw] font-medium text-primary-foreground">
                    Countdown
                  </span>
                  {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map(
                    (position) => (
                      <span
                        key={position}
                        className={cn(
                          "absolute size-2 rounded-[2px] border-[1.5px] border-primary bg-white",
                          position
                        )}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Follower goal */}
            <div className="absolute top-[9%] right-[5%] w-[28%] rounded-[1cqw] bg-white/10 p-[1.4cqw] text-white backdrop-blur">
              <div className="flex items-baseline justify-between text-[1.5cqw]">
                <span className="font-medium text-white/70">Follower goal</span>
                <span className="font-semibold tabular-nums">
                  {followers.toLocaleString("en-US")} / {GOAL.toLocaleString("en-US")}
                </span>
              </div>
              <div className="mt-[1cqw] h-[0.9cqw] overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${(followers / GOAL) * 100}%`,
                    background: "linear-gradient(90deg, #a78bfa, #f472b6)",
                  }}
                />
              </div>
            </div>

            {/* Now playing */}
            <div className="absolute bottom-[7%] left-[6%] flex w-[34%] items-center gap-[1.4cqw] rounded-[1cqw] bg-black/40 p-[1.2cqw] text-white backdrop-blur">
              <div
                className="aspect-square w-[6cqw] shrink-0 rounded-[0.6cqw]"
                style={{ background: "linear-gradient(135deg, #f472b6, #6366f1 60%, #0ea5e9)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[1.2cqw] font-medium tracking-wide text-[#1ed760]">
                  NOW PLAYING
                </p>
                <p className="truncate text-[1.9cqw] font-semibold">Midnight City</p>
                <p className="truncate text-[1.4cqw] text-white/60">M83</p>
                <div className="mt-[0.6cqw] h-[0.4cqw] overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear"
                    style={{ width: `${songProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="absolute right-[5%] bottom-[7%] flex w-[30%] flex-col gap-[0.8cqw] text-[1.45cqw] text-white">
              {chat.map(({ key, name, color, text }) => (
                <p
                  key={key}
                  className="animate-in rounded-[0.6cqw] bg-black/35 px-[1cqw] py-[0.6cqw] leading-snug backdrop-blur fade-in slide-in-from-bottom-2 duration-500"
                >
                  <span className="font-semibold" style={{ color }}>
                    {name}
                  </span>
                  <span className="text-white/85">: {text}</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <aside className="hidden w-56 shrink-0 space-y-4 border-l p-3 text-xs lg:block">
          <InspectorGroup title="Position">
            <div className="grid grid-cols-2 gap-2">
              <FakeField label="X" value="72" />
              <FakeField label="Y" value="410" />
              <FakeField label="W" value="Hug" />
              <FakeField label="H" value="Hug" />
            </div>
          </InspectorGroup>
          <InspectorGroup title="Text">
            <FakeField label="Font" value="Space Grotesk" />
            <div className="grid grid-cols-2 gap-2">
              <FakeField label="Size" value="208" />
              <FakeField label="Weight" value="Bold" />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5">
              <span className="size-3.5 rounded-sm border bg-white" />
              <span className="text-muted-foreground">#FFFFFF</span>
            </div>
          </InspectorGroup>
          <InspectorGroup title="Content">
            <FakeField label="Duration" value="05:00" />
          </InspectorGroup>
        </aside>
      </div>
    </div>
  );
};

const InspectorGroup: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="space-y-2 border-b pb-4 last:border-b-0">
    <p className="font-medium">{title}</p>
    {children}
  </div>
);

const FakeField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate">{value}</span>
  </div>
);
