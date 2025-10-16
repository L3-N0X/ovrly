/*
  Warnings:

  - You are about to drop the column `userId` on the `Editor` table. All the data in the column will be lost.
  - Added the required column `editorId` to the `Editor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Editor` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "OverlayEditor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overlayId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    CONSTRAINT "OverlayEditor_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OverlayEditor_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Editor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "editorTwitchName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Editor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Editor_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Editor" ("createdAt", "editorTwitchName", "id", "updatedAt") SELECT "createdAt", "editorTwitchName", "id", "updatedAt" FROM "Editor";
DROP TABLE "Editor";
ALTER TABLE "new_Editor" RENAME TO "Editor";
CREATE UNIQUE INDEX "Editor_ownerId_editorId_key" ON "Editor"("ownerId", "editorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OverlayEditor_overlayId_editorId_key" ON "OverlayEditor"("overlayId", "editorId");
