-- AlterEnum
ALTER TYPE "VariableProvider" ADD VALUE 'SPOTIFY';

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "max" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Progress_elementId_key" ON "Progress"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyConnection_userId_key" ON "SpotifyConnection"("userId");

-- CreateIndex
CREATE INDEX "SpotifyConnection_spotifyId_idx" ON "SpotifyConnection"("spotifyId");

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifyConnection" ADD CONSTRAINT "SpotifyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
