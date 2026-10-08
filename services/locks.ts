import type { Prisma } from "../src/generated/prisma/client";

// Row locks for read-modify-write changes, held until the surrounding transaction ends. Two
// people changing the same thing at the same time then run one after another, and the second
// change is computed from the state the first one left behind instead of overwriting it.
//
// Take an overlay's lock before any of its elements' so two transactions can never end up
// waiting on each other.

export const lockOverlay = (tx: Prisma.TransactionClient, overlayId: string) =>
  tx.$queryRaw`SELECT 1 FROM "Overlay" WHERE "id" = ${overlayId} FOR UPDATE`;

export const lockElement = (tx: Prisma.TransactionClient, elementId: string) =>
  tx.$queryRaw`SELECT 1 FROM "Element" WHERE "id" = ${elementId} FOR UPDATE`;
