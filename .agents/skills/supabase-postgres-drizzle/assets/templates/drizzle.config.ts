// Generic template only. Verify package versions and env names before use.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/backend/database/schema/**/*.ts",
  out: "./src/backend/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
