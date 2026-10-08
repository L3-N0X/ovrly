-- Sharing gets roles. The old editor tables are renamed in place so every existing share is
-- kept; all of them could change everything, so they become EDITOR.

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER', 'CONTROLLER', 'EDITOR');

-- Editor -> AccountShare
ALTER TABLE "Editor" RENAME TO "AccountShare";
ALTER TABLE "AccountShare" RENAME COLUMN "editorId" TO "userId";
ALTER TABLE "AccountShare" RENAME COLUMN "editorTwitchName" TO "twitchName";
ALTER TABLE "AccountShare" ADD COLUMN "role" "ShareRole" NOT NULL DEFAULT 'EDITOR';
ALTER TABLE "AccountShare" RENAME CONSTRAINT "Editor_pkey" TO "AccountShare_pkey";
ALTER TABLE "AccountShare" RENAME CONSTRAINT "Editor_ownerId_fkey" TO "AccountShare_ownerId_fkey";
ALTER TABLE "AccountShare" RENAME CONSTRAINT "Editor_editorId_fkey" TO "AccountShare_userId_fkey";
ALTER INDEX "Editor_ownerId_editorTwitchName_key" RENAME TO "AccountShare_ownerId_twitchName_key";
ALTER INDEX "Editor_editorId_idx" RENAME TO "AccountShare_userId_idx";
ALTER INDEX "Editor_editorTwitchName_idx" RENAME TO "AccountShare_twitchName_idx";

-- OverlayEditor -> OverlayShare
ALTER TABLE "OverlayEditor" RENAME TO "OverlayShare";
ALTER TABLE "OverlayShare" RENAME COLUMN "editorId" TO "userId";
ALTER TABLE "OverlayShare" RENAME COLUMN "editorTwitchName" TO "twitchName";
ALTER TABLE "OverlayShare" ADD COLUMN "role" "ShareRole" NOT NULL DEFAULT 'EDITOR';
ALTER TABLE "OverlayShare" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "OverlayShare" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Prisma sets updatedAt itself, the default only fills existing rows.
ALTER TABLE "OverlayShare" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "OverlayShare" RENAME CONSTRAINT "OverlayEditor_pkey" TO "OverlayShare_pkey";
ALTER TABLE "OverlayShare" RENAME CONSTRAINT "OverlayEditor_overlayId_fkey" TO "OverlayShare_overlayId_fkey";
ALTER TABLE "OverlayShare" RENAME CONSTRAINT "OverlayEditor_editorId_fkey" TO "OverlayShare_userId_fkey";
ALTER INDEX "OverlayEditor_overlayId_editorTwitchName_key" RENAME TO "OverlayShare_overlayId_twitchName_key";
ALTER INDEX "OverlayEditor_editorId_idx" RENAME TO "OverlayShare_userId_idx";
ALTER INDEX "OverlayEditor_editorTwitchName_idx" RENAME TO "OverlayShare_twitchName_idx";
