import { loadAppConfig } from "../config/app-config";
import { runMigrationsFromConfig } from "./migrations";

async function main(): Promise<void> {
  const config = loadAppConfig();
  const connectionString = config.databaseMigrationUrl ?? config.databaseUrl;
  if (!connectionString) {
    throw new Error("BACKEND_DATABASE_MIGRATION_URL or BACKEND_DATABASE_URL is required.");
  }
  const result = await runMigrationsFromConfig({
    connectionString,
    max: 1,
    application_name: "saas-app-backend-migrator",
  });
  console.log(JSON.stringify(result));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
