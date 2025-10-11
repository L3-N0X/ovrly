/*
  Warnings:

  - You are about to drop the column `counter` on the `Overlay` table. All the data in the column will be lost.
  - You are about to drop the column `style` on the `Overlay` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Overlay` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overlayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" JSONB,
    CONSTRAINT "Element_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    CONSTRAINT "Title_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "elementId" TEXT NOT NULL,
    CONSTRAINT "Counter_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateIndex
CREATE UNIQUE INDEX "Title_elementId_key" ON "Title"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_elementId_key" ON "Counter"("elementId");
