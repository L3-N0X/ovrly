import { prisma } from "../auth";
import {
  isNumericType,
  MAX_VARIABLES_PER_USER,
  type VariableType,
  type VariableValue,
} from "../lib/variables";
import { Prisma } from "../src/generated/prisma/client";
import { publishOverlay } from "./overlay-query";

// Writes variables of an account and passes them on to the variable elements showing them.
// Elements keep a copy of their variable's type and value (VariableBinding), like Twitch stats
// keep theirs, so a change is copied to them and their overlays are broadcast.

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };
type Tx = Prisma.TransactionClient;

export interface VariableWrite {
  key: string;
  type: VariableType;
  value: VariableValue;
}

export class VariableError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const lockVariables = (tx: Tx, userId: string, source: string, keys: string[]) =>
  tx.$queryRaw`
    SELECT 1 FROM "Variable"
    WHERE "userId" = ${userId} AND "source" = ${source} AND "key" = ANY(${keys})
    ORDER BY "key"
    FOR UPDATE`;

// Copies the variable `source`/`key` of `userId` (or its absence) into every element showing it,
// in that user's overlays, and returns those overlays.
const copyToBindings = async (
  tx: Tx,
  userId: string,
  source: string,
  key: string,
  variable: { type: VariableType; value: VariableValue } | null
) => {
  const where = { source, key, element: { overlay: { userId } } };
  const updated = await tx.variableBinding.updateMany({
    where,
    data: {
      type: variable?.type ?? null,
      value: variable ? variable.value : Prisma.DbNull,
      updatedAt: new Date(),
    },
  });
  if (updated.count === 0) return [];
  const bindings = await tx.variableBinding.findMany({
    where,
    select: { element: { select: { overlayId: true } } },
  });
  return bindings.map((binding) => binding.element.overlayId);
};

const publishAll = async (server: Publisher, overlayIds: Iterable<string>) => {
  for (const overlayId of new Set(overlayIds)) {
    await publishOverlay(server, overlayId);
  }
};

const sameValue = (
  current: { type: VariableType; value: unknown } | undefined,
  next: VariableWrite
) => current !== undefined && current.type === next.type && current.value === next.value;

// Creates or replaces variables of one source. Only the ones that changed are written, so an
// application may send all of its values every time without causing broadcasts.
export const setVariables = async (
  server: Publisher,
  userId: string,
  source: string,
  writes: VariableWrite[]
) => {
  // Sorted, so two requests writing the same keys lock them in the same order.
  const sorted = [...new Map(writes.map((write) => [write.key, write])).values()].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  );
  const keys = sorted.map((write) => write.key);

  const overlayIds = await prisma.$transaction(async (tx) => {
    await lockVariables(tx, userId, source, keys);
    const existing = await tx.variable.findMany({
      where: { userId, source, key: { in: keys } },
      select: { key: true, type: true, value: true },
    });
    const current = new Map(existing.map((variable) => [variable.key, variable]));

    const added = sorted.filter((write) => !current.has(write.key)).length;
    if (added > 0) {
      const count = await tx.variable.count({ where: { userId } });
      if (count + added > MAX_VARIABLES_PER_USER) {
        throw new VariableError(
          `An account can have at most ${MAX_VARIABLES_PER_USER} variables. Delete some first.`,
          409
        );
      }
    }

    const affected: string[] = [];
    for (const write of sorted) {
      if (sameValue(current.get(write.key), write)) continue;
      await tx.variable.upsert({
        where: { userId_source_key: { userId, source, key: write.key } },
        create: { userId, source, key: write.key, type: write.type, value: write.value },
        update: { type: write.type, value: write.value },
      });
      affected.push(...(await copyToBindings(tx, userId, source, write.key, write)));
    }
    return affected;
  });

  await publishAll(server, overlayIds);
  return listVariables(userId, { source, keys });
};

// Adds `by` to a number variable, on the server, so increments sent at the same time all count.
export const incrementVariable = async (
  server: Publisher,
  userId: string,
  source: string,
  key: string,
  by: number
) => {
  const overlayIds = await prisma.$transaction(async (tx) => {
    await lockVariables(tx, userId, source, [key]);
    const variable = await tx.variable.findUnique({
      where: { userId_source_key: { userId, source, key } },
      select: { type: true, value: true },
    });
    if (!variable) throw new VariableError("Variable not found", 404);
    if (!isNumericType(variable.type) || typeof variable.value !== "number") {
      throw new VariableError("Only integer and double variables can be incremented", 409);
    }
    if (variable.type === "INTEGER" && !Number.isInteger(by)) {
      throw new VariableError("Integer variables can only be incremented by whole numbers", 400);
    }
    const value = variable.value + by;
    if (variable.type === "INTEGER" ? !Number.isSafeInteger(value) : !Number.isFinite(value)) {
      throw new VariableError("The result is out of range", 400);
    }
    await tx.variable.update({
      where: { userId_source_key: { userId, source, key } },
      data: { value },
    });
    return copyToBindings(tx, userId, source, key, { type: variable.type, value });
  });

  await publishAll(server, overlayIds);
  const [variable] = await listVariables(userId, { source, keys: [key] });
  return variable;
};

// Deletes variables: all of a source, or the given keys of it. Elements showing them keep their
// binding and show nothing until the variable is sent again. Returns how many were deleted.
export const deleteVariables = async (
  server: Publisher,
  userId: string,
  source: string,
  keys?: string[]
) => {
  const { count, overlayIds } = await prisma.$transaction(async (tx) => {
    const deleted = await tx.variable.findMany({
      where: { userId, source, ...(keys ? { key: { in: keys } } : {}) },
      select: { key: true },
    });
    await tx.variable.deleteMany({
      where: { userId, source, key: { in: deleted.map((variable) => variable.key) } },
    });
    const affected: string[] = [];
    for (const { key } of deleted) {
      affected.push(...(await copyToBindings(tx, userId, source, key, null)));
    }
    return { count: deleted.length, overlayIds: affected };
  });

  await publishAll(server, overlayIds);
  return count;
};

export const listVariables = (userId: string, filter: { source?: string; keys?: string[] } = {}) =>
  prisma.variable.findMany({
    where: {
      userId,
      ...(filter.source !== undefined ? { source: filter.source } : {}),
      ...(filter.keys ? { key: { in: filter.keys } } : {}),
    },
    orderBy: [{ source: "asc" }, { key: "asc" }],
    select: { id: true, source: true, key: true, type: true, value: true, updatedAt: true },
  });

// What a binding to `source`/`key` shows for the variables of `userId` right now.
export const bindingState = async (tx: Tx, userId: string, source: string, key: string) => {
  const variable = source
    ? await tx.variable.findUnique({
        where: { userId_source_key: { userId, source, key } },
        select: { type: true, value: true, updatedAt: true },
      })
    : null;
  return {
    source,
    key,
    type: variable?.type ?? null,
    value: variable ? (variable.value as Prisma.InputJsonValue) : Prisma.DbNull,
    updatedAt: variable?.updatedAt ?? null,
  };
};

// Fills in the values of every binding of an overlay from its owner's variables. Used for
// overlays created from presets, imports and copies, whose bindings only name their variable.
export const fillOverlayBindings = async (tx: Tx, overlayId: string, userId: string) => {
  const bindings = await tx.variableBinding.findMany({
    where: { element: { overlayId }, source: { not: "" } },
    select: { id: true, source: true, key: true },
  });
  for (const binding of bindings) {
    const { type, value, updatedAt } = await bindingState(tx, userId, binding.source, binding.key);
    await tx.variableBinding.update({ where: { id: binding.id }, data: { type, value, updatedAt } });
  }
};
