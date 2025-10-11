/*
  Warnings:

  - You are about to drop the column `counter` on the `Overlay` table. All the data in the column will be lost.
  - You are about to drop the column `style` on the `Overlay` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Overlay` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "OverlayComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "overlayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OverlayComponent_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Overlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Overlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Overlay" ("createdAt", "description", "id", "name", "updatedAt", "userId") SELECT "createdAt", "description", "id", "name", "updatedAt", "userId" FROM "Overlay";
DROP TABLE "Overlay";
ALTER TABLE "new_Overlay" RENAME TO "Overlay";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
