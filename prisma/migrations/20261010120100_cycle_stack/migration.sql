-- CreateTable
CREATE TABLE "CycleStack" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "CycleStack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CycleStack_elementId_key" ON "CycleStack"("elementId");

-- AddForeignKey
ALTER TABLE "CycleStack" ADD CONSTRAINT "CycleStack_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
