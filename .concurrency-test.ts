import { prisma } from "./auth";
import { handleElementsRoutes } from "./routes/elements";
import { handleBingoRoutes } from "./routes/bingo";
import { handleReorderRoutes } from "./routes/reorder";
import { handleOverlaysRoutes } from "./routes/overlays";

// What a route puts on the wire: either an overlay snapshot (carries the revision it was
// published with, plus the writeId of the change that caused it) or a deletion notice.
type Broadcast = { type?: string; revision?: number; writeId?: string };
type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };
type RouteHandler = (req: Request, server: Publisher, path: string) => Promise<Response | null>;

const published: { channel: string; message: Broadcast }[] = [];
const server: Publisher = {
  publish: (channel, message) => published.push({ channel, message: JSON.parse(message) as Broadcast }),
};

const sign = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return `${value}.${Buffer.from(sig).toString("base64")}`;
};

const user = await prisma.user.create({ data: { name: "tester", email: `t${Date.now()}@x.y` } });
const token = `tok${Date.now()}`;
await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
const cookie = `better-auth.session_token=${encodeURIComponent(await sign(token, process.env.AUTH_SECRET!))}`;

const call = async (handler: RouteHandler, path: string, method: string, body?: unknown, writeId?: string) => {
  const res = await handler(
    new Request(`http://localhost${path}`, {
      method,
      headers: { cookie, "Content-Type": "application/json", ...(writeId ? { "X-Write-Id": writeId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    server,
    path
  );
  if (!res) throw new Error(`${method} ${path} matched no route`);
  return res;
};

const overlay = await prisma.overlay.create({ data: { name: "cc", userId: user.id, globalStyle: {} } });
const add = async (type: string) => {
  const res = await call(handleElementsRoutes, `/api/overlays/${overlay.id}/elements`, "POST", { name: type, type });
  if (res.status !== 201) throw new Error(`add ${type}: ${res.status} ${await res.text()}`);
  const o = await res.json();
  return o.elements.at(-1).id as string;
};
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);

// Elements added concurrently get distinct positions.
await Promise.all(["COUNTER", "TIMER", "BINGO", "CONTAINER", "CONTAINER", "TITLE"].map(add));
const all = await prisma.element.findMany({ where: { overlayId: overlay.id }, orderBy: { id: "asc" } });
const byType = (t: string) => all.filter((e) => e.type === t).map((e) => e.id);
const [counterId, timerId, bingoId, titleId] = ["COUNTER", "TIMER", "BINGO", "TITLE"].map((t) => byType(t)[0]);
const [boxA, boxB] = byType("CONTAINER");
const positions = (await prisma.element.findMany({ where: { overlayId: overlay.id } })).map((e) => e.position);
check("concurrent adds get unique positions", new Set(positions).size === positions.length, JSON.stringify(positions));

// 1. Counter increments.
let res = await Promise.all(Array.from({ length: 25 }, () => call(handleElementsRoutes, `/api/elements/${counterId}`, "PATCH", { data: { increment: 1 } })));
const counter = await prisma.counter.findUnique({ where: { elementId: counterId } });
check("25 concurrent +1 → 25", counter?.value === 25, `value=${counter?.value} statuses=${[...new Set(res.map((r) => r.status))]}`);

// 2. Style patches on different keys.
await Promise.all(Array.from({ length: 10 }, (_, i) => call(handleElementsRoutes, `/api/elements/${titleId}`, "PATCH", { style: { [`k${i}`]: i } })));
const title = await prisma.element.findUnique({ where: { id: titleId } });
check("10 concurrent style keys all kept", Object.keys(title!.style as object).filter((k) => k.startsWith("k")).length === 10, JSON.stringify(title!.style));
await call(handleElementsRoutes, `/api/elements/${titleId}`, "PATCH", { style: { k0: null } });
const title2 = await prisma.element.findUnique({ where: { id: titleId } });
check("null removes a style key", !("k0" in (title2!.style as object)));

// 3. Bingo cells: patch + toggle endpoint concurrently on different cells.
await Promise.all([
  ...[0, 1, 2, 3, 4, 5].map((i) => call(handleElementsRoutes, `/api/elements/${bingoId}`, "PATCH", { data: { checked: { [i]: true } } })),
  ...[6, 7, 8, 9, 10].map((i) => call(handleBingoRoutes, `/api/bingo/${bingoId}/toggle`, "POST", { index: i, checked: true })),
  ...[13, 14, 15].map((i) => call(handleElementsRoutes, `/api/elements/${bingoId}`, "PATCH", { data: { fields: { [i]: `cell ${i}` } } })),
]);
const bingo = await prisma.bingo.findUnique({ where: { elementId: bingoId } });
const checkedCount = (bingo!.checked as boolean[]).filter(Boolean).length;
check("11 concurrent cell marks all kept", checkedCount === 11, `checked=${checkedCount}`);
check("3 concurrent label edits all kept", [13, 14, 15].every((i) => (bingo!.fields as string[])[i] === `cell ${i}`));
// Same cell marked by two people → stays marked (not toggled back).
await Promise.all([0, 1].map(() => call(handleBingoRoutes, `/api/bingo/${bingoId}/toggle`, "POST", { index: 20, checked: true })));
const bingo2 = await prisma.bingo.findUnique({ where: { elementId: bingoId } });
check("same cell marked twice stays marked", (bingo2!.checked as boolean[])[20] === true);
res = [await call(handleElementsRoutes, `/api/elements/${bingoId}`, "PATCH", { data: { checked: { 99: true } } })];
check("out-of-range cell rejected", res[0].status === 400);

// 4. Timer: concurrent add time and pause/start.
await Promise.all(Array.from({ length: 10 }, () => call(handleElementsRoutes, `/api/elements/${timerId}`, "PATCH", { data: { actions: [{ type: "addTime", ms: 1000 }] } })));
let timer = await prisma.timer.findUnique({ where: { elementId: timerId } });
check("10 concurrent +1s → 10s", timer!.pausedAt?.getTime() === 10000, `pausedAt=${timer!.pausedAt?.getTime()}`);
await Promise.all([0, 1].map(() => call(handleElementsRoutes, `/api/elements/${timerId}`, "PATCH", { data: { actions: [{ type: "start" }] } })));
timer = await prisma.timer.findUnique({ where: { elementId: timerId } });
check("two people pressing start → running", timer!.startedAt !== null);
await Promise.all([0, 1].map(() => call(handleElementsRoutes, `/api/elements/${timerId}`, "PATCH", { data: { actions: [{ type: "pause" }] } })));
timer = await prisma.timer.findUnique({ where: { elementId: timerId } });
check("two people pressing pause → paused", timer!.startedAt === null && timer!.pausedAt!.getTime() >= 10000);

// 5. globalStyle patches.
await Promise.all(Array.from({ length: 8 }, (_, i) => call(handleOverlaysRoutes, `/api/overlays/${overlay.id}`, "PATCH", { globalStyle: { [`g${i}`]: i } })));
const o = await prisma.overlay.findUnique({ where: { id: overlay.id } });
check("8 concurrent globalStyle keys all kept", Object.keys(o!.globalStyle as object).length === 8, JSON.stringify(o!.globalStyle));

// 6. Concurrent moves that would form a cycle.
const statuses = (await Promise.all([
  call(handleReorderRoutes, "/api/elements/reorder", "POST", { overlayId: overlay.id, elements: [{ id: boxA, parentId: boxB, position: 0 }] }),
  call(handleReorderRoutes, "/api/elements/reorder", "POST", { overlayId: overlay.id, elements: [{ id: boxB, parentId: boxA, position: 0 }] }),
])).map((r) => r.status).sort();
const a = await prisma.element.findUnique({ where: { id: boxA } });
const b = await prisma.element.findUnique({ where: { id: boxB } });
check("crossing moves: one wins, no cycle", JSON.stringify(statuses) === "[200,400]" && !(a!.parentId === boxB && b!.parentId === boxA), JSON.stringify(statuses));
// Reorder that includes a deleted element still applies the rest.
await call(handleElementsRoutes, `/api/elements/${boxA}`, "DELETE");
res = [await call(handleReorderRoutes, "/api/elements/reorder", "POST", { overlayId: overlay.id, elements: [{ id: boxA, parentId: null, position: 0 }, { id: titleId, parentId: null, position: 42 }] })];
const t = await prisma.element.findUnique({ where: { id: titleId } });
check("reorder skips element deleted meanwhile", res[0].status === 200 && t!.position === 42, `status=${res[0].status}`);

// 7. Broadcasts: revisions strictly increase in publish order; writeId echoed; header set.
const revs = published.flatMap((p) => (p.message.revision === undefined ? [] : [p.message.revision]));
check("broadcast revisions strictly increasing", revs.every((r, i) => i === 0 || r > revs[i - 1]), `${revs.length} broadcasts`);
const r = await call(handleElementsRoutes, `/api/elements/${counterId}`, "PATCH", { data: { increment: 1 } }, "abc-1");
const last = published.at(-1)!.message;
check("writeId echoed and header matches", last.writeId === "abc-1" && r.headers.get("X-Overlay-Revision") === String(last.revision));

// 8. Overlay deletion is broadcast.
await call(handleOverlaysRoutes, `/api/overlays/${overlay.id}`, "DELETE");
check("deletion broadcast", published.at(-1)!.message.type === "deleted");

for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (${detail})`}`);
await prisma.$disconnect();
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
