import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { twitchApi, type TwitchConnection, type TwitchConnectionsResponse } from "@/lib/twitch";

// Why connecting failed, by the code routes/twitch.ts sends back.
const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Connecting was cancelled on Twitch.",
  invalid_state: "That sign-in link expired. Please try again.",
  missing_scope: "Twitch didn't allow reading subscriptions, so the channel wasn't connected.",
  not_configured: "Twitch is not set up on this server.",
  failed: "Connecting the channel failed. Please try again.",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Channels connected for their subscriber stats. Followers and viewers of any channel work
// without this; subscriptions are private on Twitch, so the channel itself has to allow them.
export const TwitchConnections: React.FC<{
  // What the Twitch callback reported, from the URL.
  connected: string | null;
  errorCode: string | null;
}> = ({ connected, errorCode }) => {
  const [data, setData] = useState<TwitchConnectionsResponse | null>(null);
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed) : null
  );
  const [removeTarget, setRemoveTarget] = useState<TwitchConnection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    twitchApi
      .connections()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const disconnect = async (connection: TwitchConnection) => {
    setRemoveTarget(null);
    setBusyId(connection.id);
    setError(null);
    try {
      setData(await twitchApi.disconnect(connection.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect the channel");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      {connected && !error && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          {connected} is connected. Its subscriber stats show up in your overlays within a minute.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="rounded-xl border bg-card">
        <div className="space-y-1 p-5 pb-4">
          <h2 className="font-medium">Connect a channel</h2>
          <p className="text-sm text-muted-foreground">
            Followers, viewers and the stream of any channel work right away once you add the channel in an overlay's Variables tab.
            Subscribers and sub points are private on Twitch: to show them, sign in to Twitch as
            the channel and allow ovrly to read its subscriptions. They are then shown in your
            overlays and in those of the people on your team.
          </p>
        </div>
        <div className="px-5 pb-5">
          {data && !data.available ? (
            <p className="text-sm text-muted-foreground">Twitch is not set up on this server.</p>
          ) : (
            // A full page load: the server sends the browser on to Twitch.
            <Button asChild>
              <a href={twitchApi.connectUrl}>
                <Plug />
                Connect a Twitch channel
              </a>
            </Button>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-medium">Connected channels</h2>
          <p className="text-sm text-muted-foreground">
            Channels whose subscriber stats your overlays can show.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          {!data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : data.connections.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No channels connected yet.
            </p>
          ) : (
            <ul className="divide-y">
              {data.connections.map((connection) => (
                <li key={connection.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#9146ff] text-sm font-semibold text-white">
                    {connection.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {connection.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      twitch.tv/{connection.login} · since {formatDate(connection.createdAt)}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => setRemoveTarget(connection)}
                  >
                    {busyId === connection.id ? <Loader2 className="animate-spin" /> : <Unplug />}
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Disconnect ${removeTarget?.displayName}?`}
        description="Overlays stop showing its subscribers and sub points. Followers and viewers keep working. You can connect it again any time."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => removeTarget && disconnect(removeTarget)}
      />
    </div>
  );
};
