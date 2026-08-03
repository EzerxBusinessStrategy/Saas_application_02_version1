import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.BACKEND_DATABASE_MIGRATION_URL ?? process.env.BACKEND_DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
