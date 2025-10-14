-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME,
    "pausedAt" DATETIME,
    "elementId" TEXT NOT NULL,
    CONSTRAINT "Timer_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Timer_elementId_key" ON "Timer"("elementId");
