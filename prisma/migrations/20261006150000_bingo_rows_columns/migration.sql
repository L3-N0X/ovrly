-- Cards were always square, so the old edge length becomes both dimensions.
ALTER TABLE "Bingo" RENAME COLUMN "size" TO "rows";
ALTER TABLE "Bingo" ADD COLUMN "columns" INTEGER NOT NULL DEFAULT 5;
UPDATE "Bingo" SET "columns" = "rows";
