-- CreateTable
CREATE TABLE "Wheel" (
    "id" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "result" TEXT,
    "fromRotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spunAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "Wheel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wheel_elementId_key" ON "Wheel"("elementId");

-- AddForeignKey
ALTER TABLE "Wheel" ADD CONSTRAINT "Wheel_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
