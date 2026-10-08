import { prisma } from "../auth";
import {
  authenticate,
  getOverlayAccess,
  requireOverlayRole,
  shareMatch,
  type OverlayAccess,
  type SessionUser,
} from "../middleware/authMiddleware";
import { json } from "../middleware/cors";
import { higherRole, parseShareRole, parseTwitchName, personKey } from "../lib/sharing";
import type { ShareRole } from "../src/generated/prisma/client";

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

const ACCESS_CHANGED = JSON.stringify({ type: "access" });
const MAX_SEARCH_RESULTS = 6;

// Tells everyone who has the overlays open that access changed, so a removed or demoted
// person's editor picks up their new role right away instead of failing on the next save.
const notifyAccessChange = (server: Publisher, overlayIds: string[]) => {
  for (const id of overlayIds) server.publish(`overlay-${id}`, ACCESS_CHANGED);
};

const ownedOverlayIds = async (ownerId: string) =>
  (await prisma.overlay.findMany({ where: { userId: ownerId }, select: { id: true } })).map(
    (o) => o.id
  );

const readBody = async (req: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

// Invitations are stored under the name the person actually signs in with when they already
// have an account, so the casing matches and the share is linked right away.
const resolveInvitee = async (twitchName: string) => {
  const user = await prisma.user.findFirst({
    where: { name: { equals: twitchName, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  return { userId: user?.id ?? null, twitchName: user?.name ?? twitchName };
};

const parseInvite = async (req: Request, owner: SessionUser) => {
  const body = await readBody(req);
  const twitchName = parseTwitchName(body?.twitchName);
  const role = parseShareRole(body?.role ?? "EDITOR");
  if (!twitchName) {
    return { error: json({ error: "Enter a valid Twitch name" }, 400) };
  }
  if (!role) {
    return { error: json({ error: "Unknown role" }, 400) };
  }
  const invitee = await resolveInvitee(twitchName);
  if (invitee.userId === owner.id || personKey(invitee.twitchName) === personKey(owner.name)) {
    return { error: json({ error: "You already have access to everything you own" }, 400) };
  }
  return { invitee, role };
};

interface PersonShare {
  id: string;
  twitchName: string;
  role: ShareRole;
  createdAt: Date;
  userId: string | null;
  user: { name: string; image: string | null } | null;
}

const personOf = (share: PersonShare) => ({
  key: personKey(share.user?.name ?? share.twitchName),
  name: share.user?.name ?? share.twitchName,
  image: share.user?.image ?? null,
  userId: share.userId,
  pending: !share.user,
});

const shareSelect = {
  id: true,
  twitchName: true,
  role: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true, image: true } },
} as const;

// Who has access to an overlay and why: through a share of the overlay, an account share of
// its owner, or both (then the higher role applies).
const loadOverlayAccess = async (overlayId: string, access: OverlayAccess, viewer: SessionUser) => {
  const [owner, overlayShares, accountShares] = await Promise.all([
    prisma.user.findUnique({
      where: { id: access.overlay.userId },
      select: { name: true, image: true },
    }),
    prisma.overlayShare.findMany({
      where: { overlayId },
      select: shareSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.accountShare.findMany({
      where: { ownerId: access.overlay.userId },
      select: shareSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type Member = ReturnType<typeof personOf> & {
    role: ShareRole;
    isYou: boolean;
    overlayShare: { id: string; role: ShareRole } | null;
    accountShare: { id: string; role: ShareRole } | null;
  };
  const members = new Map<string, Member>();
  const add = (share: PersonShare, source: "overlayShare" | "accountShare") => {
    const person = personOf(share);
    const member = members.get(person.key) ?? {
      ...person,
      role: share.role,
      isYou: share.userId === viewer.id || (!share.userId && person.key === personKey(viewer.name)),
      overlayShare: null,
      accountShare: null,
    };
    member[source] = { id: share.id, role: share.role };
    member.role = higherRole(member.role, share.role);
    members.set(person.key, member);
  };
  overlayShares.forEach((share) => add(share, "overlayShare"));
  accountShares.forEach((share) => add(share, "accountShare"));

  return {
    role: access.role,
    canManage: access.isOwner,
    owner: { name: owner?.name ?? "Unknown", image: owner?.image ?? null, isYou: access.isOwner },
    members: [...members.values()],
  };
};

// Everyone the owner shared anything with, one entry per person with all of their shares.
const loadPeople = async (ownerId: string) => {
  const [accountShares, overlayShares, overlays] = await Promise.all([
    prisma.accountShare.findMany({ where: { ownerId }, select: shareSelect }),
    prisma.overlayShare.findMany({
      where: { overlay: { userId: ownerId } },
      select: { ...shareSelect, overlay: { select: { id: true, name: true } } },
      orderBy: { overlay: { name: "asc" } },
    }),
    prisma.overlay.findMany({
      where: { userId: ownerId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  type Person = ReturnType<typeof personOf> & {
    since: Date;
    accountShare: { id: string; role: ShareRole } | null;
    overlayShares: { id: string; role: ShareRole; overlay: { id: string; name: string } }[];
  };
  const people = new Map<string, Person>();
  const entry = (share: PersonShare) => {
    const person = personOf(share);
    const existing = people.get(person.key);
    if (existing) {
      if (share.createdAt < existing.since) existing.since = share.createdAt;
      // Prefer details from a share that is already linked to an account.
      if (existing.pending && !person.pending) Object.assign(existing, person);
      return existing;
    }
    const created: Person = {
      ...person,
      since: share.createdAt,
      accountShare: null,
      overlayShares: [],
    };
    people.set(person.key, created);
    return created;
  };
  accountShares.forEach((share) => {
    entry(share).accountShare = { id: share.id, role: share.role };
  });
  overlayShares.forEach((share) => {
    entry(share).overlayShares.push({ id: share.id, role: share.role, overlay: share.overlay });
  });

  return {
    people: [...people.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    ),
    overlays,
  };
};

// Overlays and accounts other people shared with the user.
const loadIncoming = async (user: SessionUser) => {
  const [accountShares, overlayShares] = await Promise.all([
    prisma.accountShare.findMany({
      where: { ...shareMatch(user), ownerId: { not: user.id } },
      select: {
        id: true,
        role: true,
        createdAt: true,
        owner: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.overlayShare.findMany({
      where: { ...shareMatch(user), overlay: { userId: { not: user.id } } },
      select: {
        id: true,
        role: true,
        createdAt: true,
        overlay: {
          select: { id: true, name: true, user: { select: { name: true, image: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const counts = await prisma.overlay.groupBy({
    by: ["userId"],
    where: { userId: { in: accountShares.map((share) => share.owner.id) } },
    _count: { _all: true },
  });
  const countByOwner = new Map(counts.map((c) => [c.userId, c._count._all]));

  return {
    accounts: accountShares.map(({ owner, ...share }) => ({
      ...share,
      owner: { name: owner.name, image: owner.image },
      overlayCount: countByOwner.get(owner.id) ?? 0,
    })),
    overlays: overlayShares.map(({ overlay, ...share }) => ({
      ...share,
      overlay: { id: overlay.id, name: overlay.name },
      owner: overlay.user,
    })),
  };
};

const unauthorized = () => json({ error: "Unauthorized" }, 401);

export const handleSharingRoutes = async (req: Request, server: Publisher, path: string) => {
  // ---- Access to a single overlay -------------------------------------------------------
  const overlayMatch = path.match(
    /^\/api\/overlays\/([a-zA-Z0-9_-]+)\/access(?:\/([a-zA-Z0-9_-]+))?$/
  );
  if (overlayMatch) {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    const [, overlayId, shareId] = overlayMatch;

    // Anyone with access can see who else has it; only the owner can change that.
    if (req.method === "GET" && !shareId) {
      const access = await getOverlayAccess(session.user, overlayId);
      if (!access) return json({ error: "Overlay not found" }, 404);
      return json(await loadOverlayAccess(overlayId, access, session.user));
    }

    const check = await requireOverlayRole(session.user, overlayId, "OWNER");
    if (check.error) return check.error;
    const { access } = check;

    // Invites someone, or changes the role of someone already invited.
    if (req.method === "POST" && !shareId) {
      const invite = await parseInvite(req, session.user);
      if (invite.error) return invite.error;
      const { invitee, role } = invite;

      const existing = await prisma.overlayShare.findFirst({
        where: { overlayId, twitchName: { equals: invitee.twitchName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        await prisma.overlayShare.update({ where: { id: existing.id }, data: { role } });
      } else {
        await prisma.overlayShare.create({ data: { overlayId, ...invitee, role } });
      }
      notifyAccessChange(server, [overlayId]);
      return json(await loadOverlayAccess(overlayId, access, session.user), existing ? 200 : 201);
    }

    if (!shareId) return json({ error: "Method not allowed" }, 405);

    const share = await prisma.overlayShare.findFirst({
      where: { id: shareId, overlayId },
      select: { id: true },
    });
    if (!share) return json({ error: "Share not found" }, 404);

    if (req.method === "PATCH") {
      const role = parseShareRole((await readBody(req))?.role);
      if (!role) return json({ error: "Unknown role" }, 400);
      await prisma.overlayShare.update({ where: { id: share.id }, data: { role } });
      notifyAccessChange(server, [overlayId]);
      return json(await loadOverlayAccess(overlayId, access, session.user));
    }

    if (req.method === "DELETE") {
      await prisma.overlayShare.delete({ where: { id: share.id } });
      notifyAccessChange(server, [overlayId]);
      return json(await loadOverlayAccess(overlayId, access, session.user));
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // ---- Everyone the user shares with ----------------------------------------------------
  if (path === "/api/sharing/people" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    return json(await loadPeople(session.user.id));
  }

  // Removes someone from everything: their account share and every share of an overlay.
  const personMatch = path.match(/^\/api\/sharing\/people\/([^/]+)$/);
  if (personMatch && req.method === "DELETE") {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    const key = personKey(decodeURIComponent(personMatch[1]));
    const { people } = await loadPeople(session.user.id);
    const person = people.find((p) => p.key === key);
    if (!person) return json({ error: "Person not found" }, 404);

    await prisma.$transaction([
      prisma.accountShare.deleteMany({
        where: { ownerId: session.user.id, id: person.accountShare?.id ?? "" },
      }),
      prisma.overlayShare.deleteMany({
        where: {
          id: { in: person.overlayShares.map((s) => s.id) },
          overlay: { userId: session.user.id },
        },
      }),
    ]);
    notifyAccessChange(
      server,
      person.accountShare
        ? await ownedOverlayIds(session.user.id)
        : person.overlayShares.map((s) => s.overlay.id)
    );
    return json(await loadPeople(session.user.id));
  }

  // ---- Access to all of the user's overlays ---------------------------------------------
  const accountMatch = path.match(/^\/api\/sharing\/account(?:\/([a-zA-Z0-9_-]+))?$/);
  if (accountMatch) {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    const ownerId = session.user.id;
    const [, shareId] = accountMatch;

    if (req.method === "POST" && !shareId) {
      const invite = await parseInvite(req, session.user);
      if (invite.error) return invite.error;
      const { invitee, role } = invite;

      const existing = await prisma.accountShare.findFirst({
        where: { ownerId, twitchName: { equals: invitee.twitchName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        await prisma.accountShare.update({ where: { id: existing.id }, data: { role } });
      } else {
        await prisma.accountShare.create({ data: { ownerId, ...invitee, role } });
      }
      notifyAccessChange(server, await ownedOverlayIds(ownerId));
      return json(await loadPeople(ownerId), existing ? 200 : 201);
    }

    if (!shareId) return json({ error: "Method not allowed" }, 405);

    const share = await prisma.accountShare.findFirst({
      where: { id: shareId, ownerId },
      select: { id: true },
    });
    if (!share) return json({ error: "Share not found" }, 404);

    if (req.method === "PATCH") {
      const role = parseShareRole((await readBody(req))?.role);
      if (!role) return json({ error: "Unknown role" }, 400);
      await prisma.accountShare.update({ where: { id: share.id }, data: { role } });
    } else if (req.method === "DELETE") {
      await prisma.accountShare.delete({ where: { id: share.id } });
    } else {
      return json({ error: "Method not allowed" }, 405);
    }
    notifyAccessChange(server, await ownedOverlayIds(ownerId));
    return json(await loadPeople(ownerId));
  }

  // ---- What others shared with the user -------------------------------------------------
  if (path === "/api/sharing/incoming" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    return json(await loadIncoming(session.user));
  }

  // Leaving: removes the user's own share of someone's account or overlay.
  const leaveMatch = path.match(/^\/api\/sharing\/incoming\/(account|overlay)\/([a-zA-Z0-9_-]+)$/);
  if (leaveMatch && req.method === "DELETE") {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    const [, kind, shareId] = leaveMatch;

    if (kind === "account") {
      const share = await prisma.accountShare.findFirst({
        where: { id: shareId, ...shareMatch(session.user) },
        select: { id: true, ownerId: true },
      });
      if (!share) return json({ error: "Share not found" }, 404);
      await prisma.accountShare.delete({ where: { id: share.id } });
      notifyAccessChange(server, await ownedOverlayIds(share.ownerId));
    } else {
      const share = await prisma.overlayShare.findFirst({
        where: { id: shareId, ...shareMatch(session.user) },
        select: { id: true, overlayId: true },
      });
      if (!share) return json({ error: "Share not found" }, 404);
      await prisma.overlayShare.delete({ where: { id: share.id } });
      notifyAccessChange(server, [share.overlayId]);
    }
    return json(await loadIncoming(session.user));
  }

  // ---- Finding people to share with -----------------------------------------------------
  // Suggests ovrly users by Twitch name. Without a query it suggests the people the user
  // already shares with, which is who they most likely want to add again.
  if (path === "/api/users/search" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return unauthorized();
    const query = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/^@/, "");

    if (!query) {
      const { people } = await loadPeople(session.user.id);
      return json(
        people
          .slice(0, MAX_SEARCH_RESULTS)
          .map(({ name, image, pending }) => ({ name, image, pending }))
      );
    }

    const users = await prisma.user.findMany({
      where: {
        name: { startsWith: query.slice(0, 50), mode: "insensitive" },
        id: { not: session.user.id },
      },
      select: { name: true, image: true },
      orderBy: { name: "asc" },
      take: MAX_SEARCH_RESULTS,
    });
    return json(users.map((user) => ({ ...user, pending: false })));
  }

  return null;
};
