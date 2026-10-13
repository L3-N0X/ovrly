-- AlterTable
ALTER TABLE "Component" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Component_shareToken_key" ON "Component"("shareToken");
