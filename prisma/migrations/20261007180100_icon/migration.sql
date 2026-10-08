-- CreateTable
CREATE TABLE "Icon" (
    "id" TEXT NOT NULL,
    "library" TEXT NOT NULL DEFAULT 'lucide',
    "name" TEXT NOT NULL DEFAULT 'star',
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Icon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Icon_elementId_key" ON "Icon"("elementId");

-- AddForeignKey
ALTER TABLE "Icon" ADD CONSTRAINT "Icon_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
