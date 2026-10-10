import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Pencil, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AddTimeForm } from "@/components/overlay/editor/TimerEditModal";
import type { PrismaElement, SubathonStyle } from "@/lib/types";
import {
  formatAdded,
  MULTIPLIERS,
  subathonTiming,
  type SubathonAction,
  type SubathonState,
} from "@/lib/subathon";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { subathonStatus, useSubathonChannels } from "@/lib/hooks/useSubathonChannels";
import { DEFAULT_DURATION_FORMAT, formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import TimeReadout from "./TimeReadout";

interface SubathonControlProps {
  element: PrismaElement;
  onAction: (elementId: string, action: SubathonAction) => void;
}

const SubathonControl: React.FC<SubathonControlProps> = ({ element, onAction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const subathon = element.subathon;
  const style = (element.style || {}) as SubathonStyle;
  const left = useCountdown(subathonTiming(subathon));
  if (!subathon) return null;
  const running = !!subathon.endsAt;
  const over = running && left === 0;
  const act = (action: SubathonAction) => onAction(element.id, action);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <TimeReadout
          value={formatDuration(left, style.format || DEFAULT_DURATION_FORMAT)}
          title={over ? "The subathon is over" : undefined}
        />
        <Button
          onClick={() => setIsModalOpen(true)}
          title="Add or remove time"
          size="icon"
          variant="secondary"
        >
          <Pencil />
        </Button>
        <Button
          onClick={() => act({ type: running ? "pause" : "start" })}
          title={running ? "Pause" : "Start"}
          size="icon"
          variant="secondary"
        >
          {running ? <Pause /> : <Play />}
        </Button>
        <Button
          onClick={() => setIsResetOpen(true)}
          title="Reset"
          size="icon"
          variant="secondary"
        >
          <RotateCcw />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Happy hour</span>
        <SegmentedControl
          aria-label="Multiplier for what events add"
          value={String(subathon.multiplier)}
          onValueChange={(value) => act({ type: "setMultiplier", value: Number(value) })}
          options={MULTIPLIERS.map((m) => ({ value: String(m), label: `${m}×` }))}
        />
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        {subathon.subs.toLocaleString()} {subathon.subs === 1 ? "sub" : "subs"} ·{" "}
        {subathon.bits.toLocaleString()} bits · {formatAdded(subathon.addedMs)} added
        {over && " · over"}
      </p>
      <SubathonStatusLine subathon={subathon} overlayId={element.overlayId} />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust “{element.name}”</DialogTitle>
            <DialogDescription>
              Add time to the subathon or take some away. Time added by hand isn't limited by the
              most time left, and starts it again once it is over.
            </DialogDescription>
          </DialogHeader>
          {/* Mounted with the dialog, so every opening starts at zero. */}
          <AddTimeForm
            idPrefix={`${element.id}-subathon`}
            onAddTime={(ms) => {
              act({ type: "addTime", ms });
              setIsModalOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={isResetOpen}
        onOpenChange={setIsResetOpen}
        title={`Reset “${element.name}”?`}
        description={`It goes back to ${formatDuration(subathon.duration, "H[h] mm[m]")} and stops, and the subs, bits and time counted so far start over at zero.`}
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          act({ type: "reset" });
          setIsResetOpen(false);
        }}
      />
    </div>
  );
};

// Whether Twitch events are coming in, so nobody finds out after the stream that subs didn't count.
export const SubathonStatusLine = ({
  subathon,
  overlayId,
}: {
  subathon: SubathonState;
  overlayId: string | undefined;
}) => {
  const data = useSubathonChannels(overlayId);
  if (!data) return null;
  const status = subathonStatus(subathon, data);
  const settingsLink = (
    <Link to="/settings?tab=twitch" className="underline underline-offset-2">
      Settings → Twitch
    </Link>
  );

  let tone: "ok" | "wait" | "problem" = "problem";
  let text: React.ReactNode;
  switch (status.kind) {
    case "unavailable":
      text = "Twitch is not set up on this server, so no events come in.";
      break;
    case "noChannel":
      text = "Pick the Twitch channel whose subs count in the subathon's settings.";
      break;
    case "notConnected":
      text = <>The channel isn't connected, so its subs don't count. Connect it under {settingsLink}.</>;
      break;
    case "connecting":
      tone = "wait";
      text = `Connecting to ${status.channel.displayName} on Twitch…`;
      break;
    case "listening":
      tone = "ok";
      text = status.channel.bits ? (
        `Counting subs and cheers of ${status.channel.displayName}.`
      ) : (
        <>
          Counting subs of {status.channel.displayName}. To count cheers too, connect it again under{" "}
          {settingsLink}.
        </>
      );
      break;
  }

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <span
        className={cn(
          "mt-1 size-2 shrink-0 rounded-full",
          tone === "ok" && "bg-emerald-500",
          tone === "wait" && "animate-pulse bg-amber-500",
          tone === "problem" && "bg-destructive"
        )}
      />
      <span>{text}</span>
    </p>
  );
};

export default SubathonControl;
