import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrismaElement, TwitchStatType } from "@/lib/types";
import {
  formatStatValue,
  TWITCH_STATS,
  twitchApi,
  twitchStatInfo,
  twitchStatProblem,
} from "@/lib/twitchStats";

interface TwitchStatControlProps {
  element: PrismaElement;
}

// Picks the channel and the stat. The value itself comes from Twitch: the server fetches it
// and broadcasts the overlay, so changes are sent straight away instead of through the
// overlay's write queue, and a channel that doesn't exist is reported right here.
const TwitchStatControl: React.FC<TwitchStatControlProps> = ({ element }) => {
  const twitchStat = element.twitchStat;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!twitchStat) return null;

  const save = async (data: { channel?: string; stat?: TwitchStatType }) => {
    setSaving(true);
    setError(null);
    try {
      await twitchApi.updateStat(element.id, data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the Twitch stat");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const info = twitchStatInfo(twitchStat.stat);
  const problem = twitchStatProblem(twitchStat);
  const waiting = !!twitchStat.channelLogin && twitchStat.status === "PENDING";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ChannelField
          // Starts over from the saved channel whenever it changes, here or elsewhere.
          key={twitchStat.channelLogin}
          elementId={element.id}
          saved={twitchStat.channelLogin}
          disabled={saving}
          onCommit={(channel) => save({ channel })}
        />
        <Select
          value={twitchStat.stat}
          onValueChange={(stat) => save({ stat: stat as TwitchStatType })}
          disabled={saving}
        >
          <SelectTrigger className="w-36 shrink-0" aria-label="Stat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TWITCH_STATS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-1.5">
                  {option.label}
                  {option.private && <Lock className="size-3 text-muted-foreground" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-12 items-center gap-3 rounded-md bg-secondary px-3">
        <span className="text-2xl font-semibold tabular-nums">
          {formatStatValue(twitchStat.value, "full")}
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {saving || waiting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Fetching from Twitch
            </span>
          ) : twitchStat.channelLogin ? (
            `${info.label} of ${twitchStat.channelName ?? twitchStat.channelLogin}`
          ) : (
            info.label
          )}
        </span>
      </div>

      {error ? (
        <Notice>{error}</Notice>
      ) : (
        problem &&
        !waiting && (
          <Notice muted={!twitchStat.channelLogin}>
            {problem}
            {twitchStat.status === "NOT_CONNECTED" && (
              <>
                {" "}
                <Link to="/settings?tab=twitch" className="underline underline-offset-2">
                  Open settings
                </Link>
              </>
            )}
          </Notice>
        )
      )}
      {!problem && !error && info.private && twitchStat.status === "OK" && (
        <p className="text-xs text-muted-foreground">{info.description}</p>
      )}
    </div>
  );
};

// Shows the login name rather than the display name, which isn't always the login in another
// case (it can be in another script).
const ChannelField: React.FC<{
  elementId: string;
  saved: string;
  disabled: boolean;
  onCommit: (channel: string) => Promise<boolean>;
}> = ({ elementId, saved, disabled, onCommit }) => {
  const [value, setValue] = useState(saved);
  // Enter commits, and so does the blur that follows; only one of them is sent.
  const committed = useRef(saved);
  const commit = () => {
    const channel = value.trim();
    if (channel.toLowerCase() === committed.current) return;
    committed.current = channel.toLowerCase();
    // A failed one (no such channel, Twitch unreachable) can be sent again.
    onCommit(channel).then((ok) => {
      if (!ok) committed.current = saved;
    });
  };

  return (
    <Input
      id={`twitch-channel-${elementId}`}
      aria-label="Twitch channel"
      placeholder="Channel name or link"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setValue(saved);
      }}
      className="min-w-0 flex-1"
    />
  );
};

const Notice: React.FC<{ muted?: boolean; children: React.ReactNode }> = ({ muted, children }) => (
  <p
    className={
      muted
        ? "text-xs text-muted-foreground"
        : "flex gap-1.5 text-xs text-amber-600 dark:text-amber-400"
    }
  >
    {!muted && <AlertCircle className="mt-px size-3.5 shrink-0" />}
    <span>{children}</span>
  </p>
);

export default TwitchStatControl;
