import { Pool } from "pg";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");

function loadDatabaseUrl() {
  if (!existsSync(envPath)) throw new Error("apps/backend/.env not found");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith("BACKEND_DATABASE_URL=")) {
      return line.slice("BACKEND_DATABASE_URL=".length).trim();
    }
  }
  throw new Error("BACKEND_DATABASE_URL missing");
}

const pool = new Pool({
  connectionString: loadDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10_000,
});

try {
  const result = await pool.query("select current_database() as db, inet_server_addr()::text as host");
  console.log("database_ok", result.rows[0]);
} finally {
  await pool.end();
}
