-- CreateEnum
CREATE TYPE "CanvasMode" AS ENUM ('AUTO', 'FREE');

-- AlterTable
ALTER TABLE "Overlay" ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 1920,
ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 1080,
ADD COLUMN     "canvasMode" "CanvasMode" NOT NULL DEFAULT 'FREE';

-- Overlays made before the canvas was configurable were always 800x600 and always laid their
-- elements out with the global arrangement, so they keep both. Everything created from now on
-- starts at 1920x1080 with freely placed elements.
UPDATE "Overlay" SET "width" = 800, "height" = 600, "canvasMode" = 'AUTO';