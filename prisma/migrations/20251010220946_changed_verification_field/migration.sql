/*
  Warnings:

  - You are about to drop the column `token` on the `Verification` table. All the data in the column will be lost.
  - Added the required column `value` to the `Verification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Verification" (
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);
INSERT INTO "new_Verification" ("expires", "identifier") SELECT "expires", "identifier" FROM "Verification";
DROP TABLE "Verification";
ALTER TABLE "new_Verification" RENAME TO "Verification";
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
