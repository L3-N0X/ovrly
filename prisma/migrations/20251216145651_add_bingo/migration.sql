-- AlterEnum
ALTER TYPE "ElementType" ADD VALUE 'BINGO';

-- CreateTable
CREATE TABLE "Bingo" (
    "id" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 5,
    "freeMiddle" BOOLEAN NOT NULL DEFAULT false,
    "fields" JSONB NOT NULL,
    "checked" JSONB NOT NULL,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Bingo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bingo_elementId_key" ON "Bingo"("elementId");

-- AddForeignKey
ALTER TABLE "Bingo" ADD CONSTRAINT "Bingo_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
