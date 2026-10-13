-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "src" TEXT NOT NULL DEFAULT '',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_elementId_key" ON "Video"("elementId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
