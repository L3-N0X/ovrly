-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME,
    "pausedAt" DATETIME,
    "duration" INTEGER,
    "countDown" BOOLEAN NOT NULL DEFAULT false,
    "elementId" TEXT NOT NULL,
    CONSTRAINT "Timer_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Timer" ("elementId", "id", "pausedAt", "startedAt") SELECT "elementId", "id", "pausedAt", "startedAt" FROM "Timer";
DROP TABLE "Timer";
ALTER TABLE "new_Timer" RENAME TO "Timer";
CREATE UNIQUE INDEX "Timer_elementId_key" ON "Timer"("elementId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
