import { Pool } from "pg";

export function createPool(connectionString: string, max: number) {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
