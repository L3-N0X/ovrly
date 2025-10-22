/*
  Warnings:

  - Added the required column `editorTwitchName` to the `OverlayEditor` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Editor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "editorId" TEXT,
    "editorTwitchName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Editor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Editor_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Editor" ("createdAt", "editorId", "editorTwitchName", "id", "ownerId", "updatedAt") SELECT "createdAt", "editorId", "editorTwitchName", "id", "ownerId", "updatedAt" FROM "Editor";
DROP TABLE "Editor";
ALTER TABLE "new_Editor" RENAME TO "Editor";
CREATE UNIQUE INDEX "Editor_ownerId_editorTwitchName_key" ON "Editor"("ownerId", "editorTwitchName");
CREATE TABLE "new_OverlayEditor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overlayId" TEXT NOT NULL,
    "editorId" TEXT,
    "editorTwitchName" TEXT NOT NULL,
    CONSTRAINT "OverlayEditor_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OverlayEditor_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OverlayEditor" ("editorId", "id", "overlayId") SELECT "editorId", "id", "overlayId" FROM "OverlayEditor";
DROP TABLE "OverlayEditor";
ALTER TABLE "new_OverlayEditor" RENAME TO "OverlayEditor";
CREATE UNIQUE INDEX "OverlayEditor_overlayId_editorTwitchName_key" ON "OverlayEditor"("overlayId", "editorTwitchName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
