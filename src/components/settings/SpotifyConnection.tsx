import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Music, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { spotifyApi, type SpotifyConnectionResponse } from "@/lib/spotify";

// Why connecting failed, by the code routes/spotify.ts sends back.
const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Connecting was cancelled on Spotify.",
  invalid_state: "That sign-in link expired. Please try again.",
  missing_scope: "Spotify didn't allow reading what you play, so the account wasn't connected.",
  not_configured: "Spotify is not set up on this server.",
  not_registered:
    "Spotify didn't let this account in. While ovrly's Spotify app is in development mode, only accounts on its user list can connect.",
  failed: "Connecting Spotify failed. Please try again.",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The Spotify account whose playback becomes variables of the user's overlays.
export const SpotifyConnection: React.FC<{
  // What the Spotify callback reported, from the URL.
  connected: string | null;
  errorCode: string | null;
}> = ({ connected, errorCode }) => {
  const [data, setData] = useState<SpotifyConnectionResponse | null>(null);
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed) : null
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    spotifyApi
      .connection()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const disconnect = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      setData(await spotifyApi.disconnect());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Spotify");
    } finally {
      setBusy(false);
    }
  };

  const connection = data?.connection ?? null;

  return (
    <div className="space-y-8">
      {connected && !error && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          {connected} is connected. What you play shows up in the Variables tab of your overlays.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="rounded-xl border bg-card">
        <div className="space-y-1 p-5 pb-4">
          <h2 className="font-medium">Spotify</h2>
          <p className="text-sm text-muted-foreground">
            Connect your Spotify account and what you listen to becomes variables of your overlays:
            the track, artist, album and cover, whether it plays, its progress and length, the
            volume, and an accent colour taken from the cover. Bind them to titles, images,
            progress bars and colours to build your own now playing overlay. Your team sees and
            uses them in your overlays too.
          </p>
        </div>
        <div className="px-5 pb-5">
          {!data ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : !data.available ? (
            <p className="text-sm text-muted-foreground">Spotify is not set up on this server.</p>
          ) : connection ? (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-white">
                <Music className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{connection.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Connected since {formatDate(connection.createdAt)}
                </span>
              </span>
              <Button variant="outline" size="sm" asChild>
                {/* Connecting again replaces the account. */}
                <a href={spotifyApi.connectUrl}>Switch account</a>
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
                {busy ? <Loader2 className="animate-spin" /> : <Unplug />}
                Disconnect
              </Button>
            </div>
          ) : (
            // A full page load: the server sends the browser on to Spotify.
            <Button asChild>
              <a href={spotifyApi.connectUrl}>
                <Plug />
                Connect Spotify
              </a>
            </Button>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Disconnect ${connection?.displayName ?? "Spotify"}?`}
        description="Its variables are deleted, and fields bound to them go back to their own values. Connecting again brings them back, bindings and all."
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
      />
    </div>
  );
};
