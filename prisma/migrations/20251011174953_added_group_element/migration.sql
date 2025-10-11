-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "overlayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" JSONB,
    "parentId" TEXT,
    CONSTRAINT "Element_overlayId_fkey" FOREIGN KEY ("overlayId") REFERENCES "Overlay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Element_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Element" ("id", "name", "overlayId", "style", "type") SELECT "id", "name", "overlayId", "style", "type" FROM "Element";
DROP TABLE "Element";
ALTER TABLE "new_Element" RENAME TO "Element";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
