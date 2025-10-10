/*
  Warnings:

  - You are about to drop the column `title` on the `Overlay` table. All the data in the column will be lost.
  - Added the required column `name` to the `Overlay` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Overlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Overlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Overlay" ("counter", "createdAt", "description", "id", "updatedAt", "userId") SELECT "counter", "createdAt", "description", "id", "updatedAt", "userId" FROM "Overlay";
DROP TABLE "Overlay";
ALTER TABLE "new_Overlay" RENAME TO "Overlay";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
