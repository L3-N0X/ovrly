import React, { useState } from "react";
import { AlertCircle, Check, Copy, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { componentShareUrl, shareComponent, type OverlayComponent } from "@/lib/components";

// Shares a component by link: whoever opens it sees a preview and adds a copy to their own
// components with one click. Turning the link off makes it stop working; copies stay.
export const ShareComponentDialog: React.FC<{
  component: OverlayComponent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (component: OverlayComponent) => void;
}> = ({ component, open, onOpenChange, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = component?.shareToken ? componentShareUrl(component.shareToken) : null;

  const setShared = async (shared: boolean) => {
    if (!component) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await shareComponent(component.id, shared);
      onChanged(updated);
      if (shared && updated.shareToken) await copy(componentShareUrl(updated.shareToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sharing couldn't be changed.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (e.g. not focused): the link is there to copy by hand.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{component?.name}”</DialogTitle>
          <DialogDescription>
            Anyone with the link sees a preview and can add a copy to their own components, ready
            to put in their overlays.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
            {url ? (
              <Globe className="size-4 text-primary" />
            ) : (
              <Lock className="size-4 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{url ? "Anyone with the link" : "Only you"}</p>
            <p className="text-xs text-muted-foreground">
              {url
                ? "Turning it off makes the link stop working. Copies already added stay."
                : "Turn on to get a link you can send to others."}
            </p>
          </div>
          <Switch
            checked={!!url}
            disabled={busy || !component}
            onCheckedChange={(checked) => void setShared(checked)}
            aria-label="Share by link"
          />
        </div>

        {url && (
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label="Share link"
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button variant="outline" className="shrink-0" onClick={() => void copy(url)}>
              {copied ? <Check className="text-success" /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
