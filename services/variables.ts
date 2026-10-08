import { prisma } from "../auth";
import {
  isNumericType,
  isProviderSource,
  MAX_VARIABLES_PER_USER,
  parseVariableValue,
  type VariableType,
  type VariableValue,
} from "../lib/variables";
import { Prisma } from "../src/generated/prisma/client";
import { publishOverlay } from "./overlay-query";

// Writes the variables of an account. Elements are bound to variables by name
// (VariableBinding) and every overlay payload carries the values of the variables it is bound to
// (overlay-query.ts), so a change only has to be broadcast: to every overlay of the account bound
// to it, and to the account's variable channel, which editors listen on to keep their list of
// variables current.

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

// The WebSocket channel told whenever a variable of `userId` changes. It only carries
// `{ "type": "variables" }`; whoever listens fetches the list again.
export const variablesChannel = (userId: string) => `variables-${userId}`;

const lockVariables = (tx: Tx, userId: string, source: string, keys: string[]) =>
  tx.$queryRaw`
    SELECT 1 FROM "Variable"
    WHERE "userId" = ${userId} AND "source" = ${source} AND "key" = ANY(${keys})
    ORDER BY "key"
    FOR UPDATE`;

// The overlays of `userId` with an element bound to one of these variables.
const overlaysBoundTo = async (tx: Tx, userId: string, source: string, keys: string[]) => {
  if (keys.length === 0) return [];
  const bindings = await tx.variableBinding.findMany({
    where: { source, key: { in: keys }, element: { overlay: { userId } } },
    select: { element: { select: { overlayId: true } } },
  });
  return bindings.map((binding) => binding.element.overlayId);
};

const publishChanges = async (server: Publisher, userId: string, overlayIds: Iterable<string>) => {
  for (const overlayId of new Set(overlayIds)) {
    await publishOverlay(server, overlayId);
  }
  server.publish(variablesChannel(userId), JSON.stringify({ type: "variables" }));
};

const sameValue = (
  current: { type: VariableType; value: unknown } | undefined,
  next: VariableWrite
) => current !== undefined && current.type === next.type && current.value === next.value;

const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * Creates or replaces variables of one source. Only the ones that changed are written, so an
 * application may send all of its values every time without causing broadcasts. With
 * `onlyNew`, a variable that exists already is an error instead (creating one in the editor).
 */
export const setVariables = async (
  server: Publisher,
  userId: string,
  source: string,
  writes: VariableWrite[],
  { onlyNew = false } = {}
) => {
  // Sorted, so two requests writing the same keys lock them in the same order.
  const sorted = [...new Map(writes.map((write) => [write.key, write])).values()].sort(byKey);
  const keys = sorted.map((write) => write.key);

  const changed = await prisma.$transaction(async (tx) => {
    await lockVariables(tx, userId, source, keys);
    const existing = await tx.variable.findMany({
      where: { userId, source, key: { in: keys } },
      select: { key: true, type: true, value: true },
    });
    if (onlyNew && existing.length > 0) {
      throw new VariableError(`“${existing[0].key}” exists already in ${source}`, 409);
    }
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

    const changedKeys: string[] = [];
    for (const write of sorted) {
      if (sameValue(current.get(write.key), write)) continue;
      await tx.variable.upsert({
        where: { userId_source_key: { userId, source, key: write.key } },
        create: { userId, source, key: write.key, type: write.type, value: write.value },
        update: { type: write.type, value: write.value },
      });
      changedKeys.push(write.key);
    }
    return { keys: changedKeys, overlayIds: await overlaysBoundTo(tx, userId, source, changedKeys) };
  });

  if (changed.keys.length > 0) await publishChanges(server, userId, changed.overlayIds);
  return listVariables(userId, { source, keys });
};

/**
 * Sets the value of one variable, keeping its type: what changing it in the editor does.
 * Variables of providers can't be changed; their provider would overwrite them anyway.
 */
export const setVariableValue = async (
  server: Publisher,
  userId: string,
  variableId: string,
  value: unknown
) => {
  const variable = await prisma.variable.findFirst({
    where: { id: variableId, userId },
    select: { source: true, key: true, type: true },
  });
  if (!variable) throw new VariableError("Variable not found", 404);
  if (isProviderSource(variable.source)) {
    throw new VariableError("This variable is kept up to date by its provider", 409);
  }
  const parsed = parseVariableValue(variable.type, value);
  if (!parsed.ok) throw new VariableError(parsed.error, 400);
  const [updated] = await setVariables(server, userId, variable.source, [
    { key: variable.key, type: variable.type, value: parsed.value },
  ]);
  return updated;
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
    return overlaysBoundTo(tx, userId, source, [key]);
  });

  await publishChanges(server, userId, overlayIds);
  const [variable] = await listVariables(userId, { source, keys: [key] });
  return variable;
};

// Deletes variables: all of a source, or the given keys of it. Elements bound to them keep their
// binding and show their own value until a variable of that name exists again. Returns how many
// were deleted.
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
    const deletedKeys = deleted.map((variable) => variable.key);
    await tx.variable.deleteMany({ where: { userId, source, key: { in: deletedKeys } } });
    return {
      count: deleted.length,
      overlayIds: await overlaysBoundTo(tx, userId, source, deletedKeys),
    };
  });

  if (count > 0) await publishChanges(server, userId, overlayIds);
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

// The providers keeping variables of `userId` up to date.
export const listVariableSources = (userId: string) =>
  prisma.variableSource.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, provider: true, name: true, config: true, problem: true, createdAt: true },
  });

// Deletes a provider and the variables it kept up to date.
export const deleteVariableSource = async (server: Publisher, userId: string, sourceId: string) => {
  const source = await prisma.variableSource.findFirst({
    where: { id: sourceId, userId },
    select: { name: true },
  });
  if (!source) return false;
  await prisma.variableSource.deleteMany({ where: { id: sourceId } });
  await deleteVariables(server, userId, source.name);
  // The list of sources changed even when it had no variables yet.
  server.publish(variablesChannel(userId), JSON.stringify({ type: "variables" }));
  return true;
};
