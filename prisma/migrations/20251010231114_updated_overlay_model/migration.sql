-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Overlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Overlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Overlay" ("createdAt", "description", "id", "title", "updatedAt", "userId") SELECT "createdAt", "description", "id", "title", "updatedAt", "userId" FROM "Overlay";
DROP TABLE "Overlay";
ALTER TABLE "new_Overlay" RENAME TO "Overlay";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
