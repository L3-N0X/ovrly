-- CreateEnum
CREATE TYPE "CountdownMode" AS ENUM ('DURATION', 'TARGET');

-- CreateTable
CREATE TABLE "Countdown" (
    "id" TEXT NOT NULL,
    "mode" "CountdownMode" NOT NULL DEFAULT 'DURATION',
    "duration" INTEGER NOT NULL DEFAULT 300000,
    "remaining" INTEGER NOT NULL DEFAULT 300000,
    "endsAt" TIMESTAMP(3),
    "targetAt" TIMESTAMP(3),
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Countdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Countdown_elementId_key" ON "Countdown"("elementId");

-- AddForeignKey
ALTER TABLE "Countdown" ADD CONSTRAINT "Countdown_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Timers that counted down become countdowns, keeping the time they had left and whether they
-- were running. A timer stored its elapsed time in "pausedAt", relative to the epoch.
INSERT INTO "Countdown" ("id", "mode", "duration", "remaining", "endsAt", "elementId")
SELECT
    t."id",
    'DURATION',
    COALESCE(t."duration", 0),
    LEAST(2147483647, GREATEST(0,
        COALESCE(t."duration", 0) - COALESCE(EXTRACT(EPOCH FROM t."pausedAt") * 1000, 0)
    ))::INTEGER,
    CASE WHEN t."startedAt" IS NOT NULL THEN
        t."startedAt" + (
            COALESCE(t."duration", 0) - COALESCE(EXTRACT(EPOCH FROM t."pausedAt") * 1000, 0)
        ) * INTERVAL '1 millisecond'
    END,
    t."elementId"
FROM "Timer" t
WHERE t."countDown";

UPDATE "Element" SET "type" = 'COUNTDOWN'
WHERE "id" IN (SELECT "elementId" FROM "Timer" WHERE "countDown");

DELETE FROM "Timer" WHERE "countDown";

-- AlterTable
ALTER TABLE "Timer" DROP COLUMN "countDown",
DROP COLUMN "duration";
