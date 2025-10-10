/*
  Warnings:

  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VerificationToken";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Verification" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Verification_token_key" ON "Verification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_token_key" ON "Verification"("identifier", "token");
