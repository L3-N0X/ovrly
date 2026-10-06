import type { OverlayMember } from "@/lib/types";

export const ROLE_LABELS: Record<OverlayMember["role"], string> = {
  owner: "Owner",
  editor: "Editor",
  global: "Global editor",
};
