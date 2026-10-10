-- CreateTable
CREATE TABLE "Subathon" (
    "id" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 3600000,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 3600000,
    "endsAt" TIMESTAMP(3),
    "channelId" TEXT,
    "tier1Ms" INTEGER NOT NULL DEFAULT 300000,
    "tier2Ms" INTEGER NOT NULL DEFAULT 600000,
    "tier3Ms" INTEGER NOT NULL DEFAULT 1500000,
    "bitsMs" INTEGER NOT NULL DEFAULT 60000,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxRemaining" DOUBLE PRECISION,
    "countWhilePaused" BOOLEAN NOT NULL DEFAULT true,
    "subs" INTEGER NOT NULL DEFAULT 0,
    "bits" INTEGER NOT NULL DEFAULT 0,
    "addedMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAddedMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAddedAt" TIMESTAMP(3),
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Subathon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subathon_elementId_key" ON "Subathon"("elementId");

-- CreateIndex
CREATE INDEX "Subathon_channelId_idx" ON "Subathon"("channelId");

-- AddForeignKey
ALTER TABLE "Subathon" ADD CONSTRAINT "Subathon_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
