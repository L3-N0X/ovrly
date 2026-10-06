import { Crown, Eye, PencilRuler, SlidersHorizontal, type LucideIcon } from "lucide-react";

// Mirrors lib/sharing.ts on the server.
export type ShareRole = "VIEWER" | "CONTROLLER" | "EDITOR";
export type AccessRole = ShareRole | "OWNER";

export const SHARE_ROLES: ShareRole[] = ["EDITOR", "CONTROLLER", "VIEWER"];

const RANK: Record<AccessRole, number> = { VIEWER: 1, CONTROLLER: 2, EDITOR: 3, OWNER: 4 };

export const hasRole = (role: AccessRole | null | undefined, required: AccessRole) =>
  !!role && RANK[role] >= RANK[required];

export const ROLE_INFO: Record<
  AccessRole,
  { label: string; verb: string; description: string; icon: LucideIcon }
> = {
  OWNER: {
    label: "Owner",
    verb: "Owner",
    description: "Full access, decides who else gets access.",
    icon: Crown,
  },
  EDITOR: {
    label: "Editor",
    verb: "Can edit",
    description: "Changes the design: elements, layout and styles.",
    icon: PencilRuler,
  },
  CONTROLLER: {
    label: "Controller",
    verb: "Can control",
    description: "Runs it live: counters, timers, titles and bingo.",
    icon: SlidersHorizontal,
  },
  VIEWER: {
    label: "Viewer",
    verb: "Can view",
    description: "Sees the overlay and its live state.",
    icon: Eye,
  },
};

export interface ShareRef {
  id: string;
  role: ShareRole;
}

// Someone with access to an overlay, as returned by GET /api/overlays/:id/access.
export interface OverlayAccessMember {
  key: string;
  name: string;
  image: string | null;
  pending: boolean;
  isYou: boolean;
  // The effective role: the higher of the two shares below.
  role: ShareRole;
  overlayShare: ShareRef | null;
  accountShare: ShareRef | null;
}

export interface OverlayAccess {
  role: AccessRole;
  canManage: boolean;
  owner: { name: string; image: string | null; isYou: boolean };
  members: OverlayAccessMember[];
}

// Someone the current user shares with (GET /api/sharing/people).
export interface SharedPerson {
  key: string;
  name: string;
  image: string | null;
  pending: boolean;
  since: string;
  accountShare: ShareRef | null;
  overlayShares: (ShareRef & { overlay: { id: string; name: string } })[];
}

export interface PeopleResponse {
  people: SharedPerson[];
  overlays: { id: string; name: string }[];
}

export interface IncomingResponse {
  accounts: {
    id: string;
    role: ShareRole;
    createdAt: string;
    owner: { name: string; image: string | null };
    overlayCount: number;
  }[];
  overlays: {
    id: string;
    role: ShareRole;
    createdAt: string;
    overlay: { id: string; name: string };
    owner: { name: string; image: string | null };
  }[];
}

export interface UserSuggestion {
  name: string;
  image: string | null;
  pending: boolean;
}

// Carries the HTTP status, so callers can tell "no access" (404) from a network hiccup.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "include",
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      typeof data?.error === "string" ? data.error : "Something went wrong",
      response.status
    );
  }
  return data as T;
};

export const sharingApi = {
  overlayAccess: (overlayId: string) => request<OverlayAccess>(`/api/overlays/${overlayId}/access`),
  shareOverlay: (overlayId: string, twitchName: string, role: ShareRole) =>
    request<OverlayAccess>(`/api/overlays/${overlayId}/access`, {
      method: "POST",
      body: { twitchName, role },
    }),
  setOverlayRole: (overlayId: string, shareId: string, role: ShareRole) =>
    request<OverlayAccess>(`/api/overlays/${overlayId}/access/${shareId}`, {
      method: "PATCH",
      body: { role },
    }),
  unshareOverlay: (overlayId: string, shareId: string) =>
    request<OverlayAccess>(`/api/overlays/${overlayId}/access/${shareId}`, { method: "DELETE" }),

  people: () => request<PeopleResponse>("/api/sharing/people"),
  shareAccount: (twitchName: string, role: ShareRole) =>
    request<PeopleResponse>("/api/sharing/account", { method: "POST", body: { twitchName, role } }),
  setAccountRole: (shareId: string, role: ShareRole) =>
    request<PeopleResponse>(`/api/sharing/account/${shareId}`, { method: "PATCH", body: { role } }),
  unshareAccount: (shareId: string) =>
    request<PeopleResponse>(`/api/sharing/account/${shareId}`, { method: "DELETE" }),
  removePerson: (key: string) =>
    request<PeopleResponse>(`/api/sharing/people/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }),

  incoming: () => request<IncomingResponse>("/api/sharing/incoming"),
  leave: (kind: "account" | "overlay", shareId: string) =>
    request<IncomingResponse>(`/api/sharing/incoming/${kind}/${shareId}`, { method: "DELETE" }),

  searchUsers: (query: string) =>
    request<UserSuggestion[]>(`/api/users/search?q=${encodeURIComponent(query)}`),
};
