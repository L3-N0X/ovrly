import React from "react";
import type { OverlayMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "./members";

// Background colours for people without a profile picture, picked from their name so the
// same person always gets the same one.
const FALLBACK_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-fuchsia-500",
  "bg-teal-500",
  "bg-indigo-500",
];

const colorFor = (name: string) => {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
};

export const Avatar: React.FC<{ member: Pick<OverlayMember, "name" | "image">; className?: string }> = ({
  member,
  className,
}) =>
  member.image ? (
    <img
      src={member.image}
      alt=""
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white uppercase",
        colorFor(member.name),
        className
      )}
    >
      {member.name.slice(0, 1)}
    </span>
  );

interface AvatarStackProps {
  members: OverlayMember[];
  // How many circles to show before collapsing the rest into a "+N" one.
  max?: number;
  className?: string;
}

// Overlapping profile pictures. Hovering the stack fans it out a little.
const AvatarStack: React.FC<AvatarStackProps> = ({ members, max = 4, className }) => {
  // Showing `max` circles, or `max - 1` and a counter, keeps the stack the same width.
  const visible = members.length > max ? members.slice(0, max - 1) : members;
  const hidden = members.length - visible.length;

  return (
    <div className={cn("group/stack flex items-center", className)}>
      {visible.map((member, index) => (
        <span
          key={member.name}
          title={`${member.name} · ${ROLE_LABELS[member.role]}`}
          className={cn(
            "relative rounded-full ring-2 ring-card transition-[margin] duration-200",
            index > 0 && "-ml-2.5 group-hover/stack:-ml-1"
          )}
          style={{ zIndex: visible.length - index }}
        >
          <Avatar member={member} />
        </span>
      ))}
      {hidden > 0 && (
        <span
          title={members
            .slice(visible.length)
            .map((m) => m.name)
            .join(", ")}
          className="relative -ml-2.5 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card transition-[margin] duration-200 group-hover/stack:-ml-1"
        >
          +{hidden}
        </span>
      )}
    </div>
  );
};

export default AvatarStack;
