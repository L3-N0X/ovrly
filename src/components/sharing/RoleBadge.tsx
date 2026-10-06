import React from "react";
import { ROLE_INFO, type AccessRole } from "@/lib/sharing";
import { cn } from "@/lib/utils";

// A small pill naming a role, e.g. "Editor" or, with `verb`, "Can edit".
export const RoleBadge: React.FC<{ role: AccessRole; verb?: boolean; className?: string }> = ({
  role,
  verb = false,
  className,
}) => {
  const { label, verb: verbLabel, icon: Icon } = ROLE_INFO[role];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap text-muted-foreground",
        role === "OWNER" && "border-primary/30 bg-primary/10 text-primary",
        className
      )}
    >
      <Icon className="size-3" />
      {verb ? verbLabel : label}
    </span>
  );
};

// "Pending" marker for people invited by name who haven't signed in yet.
export const PendingBadge: React.FC<{ className?: string }> = ({ className }) => (
  <span
    title="Invited by Twitch name. They get access as soon as they sign in to ovrly."
    className={cn(
      "inline-flex h-5 shrink-0 items-center rounded-full border border-dashed px-2 text-[11px] font-medium text-muted-foreground",
      className
    )}
  >
    Pending
  </span>
);
