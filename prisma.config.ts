import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // `prisma generate` never connects to the database, so requiring
  // DATABASE_URL here would break offline codegen (CI, Docker build stage,
  // fresh clone without a .env). The datasource is only needed by migration
  // and introspection commands, which fail with their own error if it is
  // missing.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});