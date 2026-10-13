import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { useSubathonChannels } from "@/lib/hooks/useSubathonChannels";
import {
  MAX_RATE_MS,
  MAX_SUBATHON_MS,
  type SubathonSettings,
  type SubathonState,
} from "@/lib/subathon";
import type { PrismaElement, SubathonStyle } from "@/lib/types";
import { TimerStyleEditor } from "./TimerEditor";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// Select items need a value; this one stands for "no channel picked", the owner's own.
const OWN_CHANNEL = "own";

const settingsOf = (subathon: SubathonState) => ({
  duration: subathon.duration,
  channelId: subathon.channelId,
  tier1Ms: subathon.tier1Ms,
  tier2Ms: subathon.tier2Ms,
  tier3Ms: subathon.tier3Ms,
  bitsMs: subathon.bitsMs,
  maxRemaining: subathon.maxRemaining,
  countWhilePaused: subathon.countWhilePaused,
});

// What the subathon listens to and what events are worth. Editors only: controllers run it.
export const SubathonSettingsEditor: React.FC<{
  element: PrismaElement;
  onChange: (settings: SubathonSettings) => void;
}> = ({ element, onChange }) => {
  const subathon = element.subathon!;
  const channels = useSubathonChannels(element.overlayId);
  // Memoized so the identity only changes when the server's values do: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const settingsKey = JSON.stringify(settingsOf(subathon));
  const serverSettings = useMemo(
    () => JSON.parse(settingsKey) as ReturnType<typeof settingsOf>,
    [settingsKey]
  );
  const { value: settings, setValue: setSettings } = useLocalCopy(serverSettings);

  const update = (patch: SubathonSettings) => {
    setSettings({ ...settings, ...patch });
    onChange(patch);
  };
  const id = (name: string) => `${element.id}-subathon-${name}`;

  const ownChannel = channels?.channels.find((c) => c.twitchId === channels.ownChannelId);
  const otherChannels = channels?.channels.filter((c) => c.twitchId !== channels.ownChannelId) ?? [];
  const picked = settings.channelId;
  const pickedMissing =
    picked !== null && channels !== null && !channels.channels.some((c) => c.twitchId === picked);

  const rate = (key: "tier1Ms" | "tier2Ms" | "tier3Ms" | "bitsMs", label: string) => (
    <div className="space-y-2">
      <Label htmlFor={id(key)}>{label}</Label>
      <NumberField
        id={id(key)}
        value={settings[key] / MINUTE}
        min={0}
        max={MAX_RATE_MS / MINUTE}
        step={0.5}
        unit="min"
        onChange={(minutes) => update({ [key]: Math.round(minutes * MINUTE) })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id("channel")}>Twitch channel</Label>
        <Select
          value={picked ?? OWN_CHANNEL}
          onValueChange={(value) => update({ channelId: value === OWN_CHANNEL ? null : value })}
        >
          <SelectTrigger id={id("channel")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OWN_CHANNEL}>
              {ownChannel ? `${ownChannel.displayName} (owner's channel)` : "The owner's channel"}
            </SelectItem>
            {otherChannels.map((channel) => (
              <SelectItem key={channel.twitchId} value={channel.twitchId}>
                {channel.displayName}
              </SelectItem>
            ))}
            {pickedMissing && <SelectItem value={picked}>A channel that isn't connected</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("duration-hours")}>Starts at</Label>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            id={id("duration-hours")}
            aria-label="Hours"
            value={Math.floor(settings.duration / HOUR)}
            min={0}
            max={MAX_SUBATHON_MS / HOUR}
            unit="h"
            onChange={(hours) =>
              update({
                duration: Math.min(
                  MAX_SUBATHON_MS,
                  Math.round(hours) * HOUR + (settings.duration % HOUR)
                ),
              })
            }
          />
          <NumberField
            aria-label="Minutes"
            value={Math.floor((settings.duration % HOUR) / MINUTE)}
            min={0}
            max={59}
            unit="min"
            onChange={(minutes) =>
              update({
                duration: Math.min(
                  MAX_SUBATHON_MS,
                  Math.floor(settings.duration / HOUR) * HOUR + Math.round(minutes) * MINUTE
                ),
              })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Before it has started this is also the time left; afterwards it applies from the next
          reset.
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Time added</h4>
        <div className="grid grid-cols-2 gap-4">
          {rate("tier1Ms", "Tier 1 / Prime sub")}
          {rate("tier2Ms", "Tier 2 sub")}
          {rate("tier3Ms", "Tier 3 sub")}
          {rate("bitsMs", "Per 100 bits")}
        </div>
        <p className="text-xs text-muted-foreground">
          New subs, gifted subs (each one of a gift bomb) and resubs shared in chat count. Bits
          count in proportion: 250 bits add two and a half times the time for 100.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id("cap")}>Limit the time left</Label>
          <Switch
            id={id("cap")}
            checked={settings.maxRemaining !== null}
            onCheckedChange={(on) =>
              update({
                maxRemaining: on
                  ? Math.max(24 * HOUR, Math.ceil(subathon.remaining / HOUR) * HOUR)
                  : null,
              })
            }
          />
        </div>
        {settings.maxRemaining !== null && (
          <div className="space-y-2">
            <Label htmlFor={id("cap-hours")}>Most time left</Label>
            <NumberField
              id={id("cap-hours")}
              value={settings.maxRemaining / HOUR}
              min={1}
              max={MAX_SUBATHON_MS / HOUR}
              step={1}
              unit="h"
              onChange={(hours) => update({ maxRemaining: Math.max(HOUR, Math.round(hours * HOUR)) })}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Events don't take the time left past the limit, so the subathon can end. They still count
          as subs and bits.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={id("paused")}>Count while paused</Label>
          <p className="text-xs text-muted-foreground">
            Subs before you start (with the overlay open) add time too.
          </p>
        </div>
        <Switch
          id={id("paused")}
          checked={settings.countWhilePaused}
          onCheckedChange={(countWhilePaused) => update({ countWhilePaused })}
        />
      </div>
    </div>
  );
};

// How the subathon looks: a timer's style, plus what it shows when time is added or it is over.
export const SubathonStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: SubathonStyle) => void;
}> = ({ element, onChange }) => {
  const style = (element.style || {}) as SubathonStyle;
  const id = (name: string) => `${element.id}-subathon-${name}`;

  return (
    <div className="space-y-4">
      <TimerStyleEditor element={element} onChange={onChange} />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id("show-added")}>Show added time</Label>
        <Switch
          id={id("show-added")}
          checked={style.showAdded !== false}
          onCheckedChange={(showAdded) => onChange({ ...style, showAdded })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("ended-text")}>Text when over</Label>
        <Input
          id={id("ended-text")}
          value={style.endedText ?? ""}
          placeholder="Shows 00:00:00"
          onChange={(e) => onChange({ ...style, endedText: e.target.value })}
          className="h-10"
        />
      </div>
    </div>
  );
};
