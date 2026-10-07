/**
 * Dev supervisor for the Bun backend.
 *
 * `bun run dev` used to start `server.ts` as a plain process, so every code or
 * schema change left the previous build listening on port 3000 until someone
 * restarted it by hand. This script owns that process instead: it restarts the
 * backend after a change, and it regenerates the Prisma client first when
 * `prisma/schema.prisma` moves so the reloaded server talks to a client that
 * matches the schema.
 *
 * Restarting a child process rather than relying on `bun --hot` keeps
 * `Bun.serve` and the heartbeat interval in one place: every change gets a
 * fresh process, with no listener or timer left over from the previous one.
 */
import { existsSync, statSync, watch } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import type { Subprocess } from "bun";
import ts from "typescript";

const root = path.join(import.meta.dirname, "..");
const entry = "server.ts";
// Kept in sync with Bun.serve in server.ts so the restart waits for the port the
// backend actually binds.
const port = Number(process.env.PORT ?? 3000);

/** Coalesces the burst of events an editor (or `git checkout`) produces. */
const DEBOUNCE_MS = 80;
/** A process that dies this fast after starting is crashing, not exiting. */
const CRASH_WINDOW_MS = 2_000;
/** Retry delay once the backend has crashed repeatedly in a row. */
const CRASH_BACKOFF_MS = 5_000;
/** How long the old process gets to release the port before SIGKILL. */
const TERM_GRACE_MS = 2_000;
/** How long to wait for the port before starting anyway. */
const PORT_WAIT_MS = 5_000;

const log = (message: string) => console.log(`[dev:server] ${message}`);

interface WatchTarget {
  dir: string;
  recursive: boolean;
  matches: (relative: string) => boolean;
}

/**
 * The backend is exactly what `tsconfig.server.json` compiles, so the watched
 * paths are read from there instead of a second hardcoded list that could drift.
 * `prisma/schema.prisma` is watched as well: it is not an import, so nothing
 * else would notice it, but the client it generates is loaded by `auth.ts` and
 * has to be regenerated for a restart to be worth anything.
 *
 * `scripts/` is not part of the backend, so it is left out on purpose: these are
 * one-off maintenance tasks rather than modules the running server loads.
 */
function watchedPaths(): string[] {
  const configPath = path.join(root, "tsconfig.server.json");
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error || !Array.isArray(config.include)) {
    throw new Error(`Could not read "include" from ${path.relative(root, configPath)}: ${ts.flattenDiagnosticMessageText(error?.messageText ?? "missing include", " ")}`);
  }
  const entries = config.include.map((value: unknown) => {
    if (typeof value !== "string") throw new Error("Unexpected non-string entry in tsconfig include");
    return path.normalize(value);
  });
  return [...entries, "prisma/schema.prisma"];
}

/**
 * Directories are watched recursively so a new backend module is picked up too.
 * Single files are watched through their parent directory, because editors that
 * save atomically replace the inode and would leave a dead watcher behind.
 */
function watchTargets(paths: string[]): WatchTarget[] {
  return paths.map((entryPath) => {
    const absolute = path.join(root, entryPath);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      return {
        dir: absolute,
        recursive: true,
        matches: (relative: string) => relative === entryPath || relative.startsWith(`${entryPath}${path.sep}`),
      };
    }
    return { dir: path.dirname(absolute), recursive: false, matches: (relative: string) => relative === entryPath };
  });
}

/** True while something still holds the port, i.e. the previous process is dying. */
function isPortBusy(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const settle = (busy: boolean) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(500, () => settle(false));
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
  });
}

async function waitForPort(): Promise<void> {
  const deadline = Date.now() + PORT_WAIT_MS;
  while (Date.now() < deadline) {
    if (!(await isPortBusy())) return;
    await Bun.sleep(50);
  }
  log(`port ${port} is still in use, starting anyway`);
}

async function regeneratePrismaClient(): Promise<void> {
  const binary = path.join(root, "node_modules", ".bin", "prisma");
  if (!existsSync(binary)) {
    log("prisma binary not found, skipping generate (run bun install)");
    return;
  }
  log("prisma/schema.prisma changed, regenerating the client");
  const generate = Bun.spawn([binary, "generate"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    generate.exited,
    new Response(generate.stdout).text(),
    new Response(generate.stderr).text(),
  ]);
  if (code === 0) {
    log("prisma client regenerated");
    return;
  }
  log(`prisma generate failed (exit code ${code}), restarting with the old client:`);
  log((stderr || stdout).trim());
  log("apply migrations yourself when the schema is valid again: bunx prisma migrate dev");
}

interface Running {
  process: Subprocess;
  /** Set when the process was killed on purpose, so its exit is not a crash. */
  expected: boolean;
}

let running: Running | null = null;
let stopping = false;
let restarting = false;
let queuedRestart: string | null = null;
let schemaDirty = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let consecutiveCrashes = 0;
let lastExitAt = 0;

function start(): void {
  const child: Running = {
    process: Bun.spawn([process.execPath, entry], {
      cwd: root,
      stdout: "inherit",
      stderr: "inherit",
    }),
    expected: false,
  };
  running = child;

  void child.process.exited.then((code) => {
    if (running === child) running = null;
    if (stopping || child.expected) return;

    const crashed = Date.now() - lastExitAt < CRASH_WINDOW_MS;
    consecutiveCrashes = crashed ? consecutiveCrashes + 1 : 0;
    lastExitAt = Date.now();
    const reason = child.process.signalCode ? `signal ${child.process.signalCode}` : `exit code ${code}`;
    const delay = consecutiveCrashes > 1 ? CRASH_BACKOFF_MS : 100;
    if (consecutiveCrashes > 1) {
      log(`${entry} keeps crashing (${reason}), retrying in ${delay / 1_000}s`);
    } else {
      log(`${entry} stopped on its own (${reason}), restarting`);
    }
    setTimeout(() => {
      if (!stopping && !running) start();
    }, delay);
  });
}

async function stopChild(child: Running): Promise<void> {
  child.expected = true;
  child.process.kill("SIGTERM");
  await Promise.race([child.process.exited, Bun.sleep(TERM_GRACE_MS)]);
  if (child.process.exitCode === null) child.process.kill("SIGKILL");
}

async function restart(reason: string): Promise<void> {
  if (restarting) {
    // A change landed mid-restart; redo the restart once this one is done.
    queuedRestart = reason;
    return;
  }
  restarting = true;
  try {
    if (schemaDirty) {
      schemaDirty = false;
      await regeneratePrismaClient();
    }
    log(`restarting because ${reason} changed`);
    const old = running;
    running = null;
    if (old) await stopChild(old);
    await waitForPort();
    if (!stopping) start();
  } finally {
    restarting = false;
    if (queuedRestart && !stopping) {
      const queued = queuedRestart;
      queuedRestart = null;
      await restart(queued);
    }
  }
}

function scheduleRestart(relative: string): void {
  if (relative === "prisma/schema.prisma") schemaDirty = true;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void restart(relative);
  }, DEBOUNCE_MS);
}

const watched = watchedPaths();
for (const target of watchTargets(watched)) {
  watch(target.dir, { recursive: target.recursive }, (_event, filename) => {
    if (!filename) return;
    const relative = path.relative(root, path.join(target.dir, filename.toString()));
    if (target.matches(relative)) scheduleRestart(relative);
  });
}
log(`watching ${watched.join(", ")}`);

/**
 * Shutdown has to end this process, not just the child: the watchers alone keep
 * the event loop alive, and a lingering supervisor would hold the port or the
 * terminal long after the backend is gone.
 */
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  const old = running;
  running = null;
  if (old) await stopChild(old);
  log("stopped");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

start();