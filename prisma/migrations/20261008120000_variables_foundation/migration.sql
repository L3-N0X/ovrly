-- Twitch stat and variable elements are replaced by variables that any element property can be
-- bound to (docs/variables.md). Their elements go first; the cascade takes their TwitchStat and
-- VariableBinding rows along.
DELETE FROM "Element" WHERE "type" IN ('TWITCH_STAT', 'VARIABLE');
-- Bindings of the old shape can't be carried over; there shouldn't be any left.
DELETE FROM "VariableBinding";

-- CreateEnum
CREATE TYPE "VariableProvider" AS ENUM ('TWITCH');

-- AlterEnum
BEGIN;
CREATE TYPE "ElementType_new" AS ENUM ('TITLE', 'COUNTER', 'TIMER', 'CONTAINER', 'IMAGE', 'GROUP', 'BINGO', 'COUNTDOWN', 'ICON');
ALTER TABLE "Element" ALTER COLUMN "type" TYPE "ElementType_new" USING ("type"::text::"ElementType_new");
ALTER TYPE "ElementType" RENAME TO "ElementType_old";
ALTER TYPE "ElementType_new" RENAME TO "ElementType";
DROP TYPE "public"."ElementType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "VariableType" ADD VALUE 'IMAGE';

-- DropForeignKey
ALTER TABLE "TwitchStat" DROP CONSTRAINT "TwitchStat_elementId_fkey";

-- DropIndex
DROP INDEX "VariableBinding_elementId_key";

-- AlterTable
ALTER TABLE "VariableBinding" DROP COLUMN "type",
DROP COLUMN "updatedAt",
DROP COLUMN "value",
ADD COLUMN     "property" TEXT NOT NULL,
ALTER COLUMN "source" DROP DEFAULT,
ALTER COLUMN "key" DROP DEFAULT;

-- DropTable
DROP TABLE "TwitchStat";

-- DropEnum
DROP TYPE "TwitchStatStatus";

-- DropEnum
DROP TYPE "TwitchStatType";

-- CreateTable
CREATE TABLE "VariableSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "VariableProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "problem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariableSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariableSource_externalId_idx" ON "VariableSource"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "VariableSource_userId_name_key" ON "VariableSource"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VariableBinding_elementId_property_key" ON "VariableBinding"("elementId", "property");

-- AddForeignKey
ALTER TABLE "VariableSource" ADD CONSTRAINT "VariableSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
