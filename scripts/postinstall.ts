/**
 * Prisma 7 no longer auto-generates the client on install, so generate it here.
 *
 * The schema and prisma.config.ts are copied after `bun install` in the Docker
 * build (to keep the dependency layer cached), so generation is skipped when the
 * schema is not present yet. The image runs an explicit `prisma generate`.
 */
import { existsSync } from "fs";
import path from "path";

const root = path.join(import.meta.dirname, "..");

if (!existsSync(path.join(root, "prisma", "schema.prisma"))) {
  console.log("[postinstall] prisma/schema.prisma not found, skipping generate.");
  process.exit(0);
}

const { $ } = Bun;

await $`prisma generate`.quiet();