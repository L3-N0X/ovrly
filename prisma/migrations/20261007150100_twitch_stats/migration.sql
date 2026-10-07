-- CreateEnum
CREATE TYPE "TwitchStatType" AS ENUM ('FOLLOWERS', 'VIEWERS', 'SUBSCRIBERS', 'SUB_POINTS');

-- CreateEnum
CREATE TYPE "TwitchStatStatus" AS ENUM ('PENDING', 'OK', 'NOT_CONNECTED', 'NOT_ALLOWED');

-- CreateTable
CREATE TABLE "TwitchStat" (
    "id" TEXT NOT NULL,
    "stat" "TwitchStatType" NOT NULL DEFAULT 'FOLLOWERS',
    "channelLogin" TEXT NOT NULL DEFAULT '',
    "channelId" TEXT,
    "channelName" TEXT,
    "value" INTEGER,
    "status" "TwitchStatStatus" NOT NULL DEFAULT 'PENDING',
    "fetchedAt" TIMESTAMP(3),
    "elementId" TEXT NOT NULL,

    CONSTRAINT "TwitchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twitchId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStat_elementId_key" ON "TwitchStat"("elementId");

-- CreateIndex
CREATE INDEX "TwitchStat_channelId_idx" ON "TwitchStat"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchConnection_twitchId_key" ON "TwitchConnection"("twitchId");

-- CreateIndex
CREATE INDEX "TwitchConnection_userId_idx" ON "TwitchConnection"("userId");

-- AddForeignKey
ALTER TABLE "TwitchStat" ADD CONSTRAINT "TwitchStat_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchConnection" ADD CONSTRAINT "TwitchConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

