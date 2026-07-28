import type { Pool, PoolClient } from "pg";

export async function withTransaction<T>(
  pool: Pool,
  context: { userId: string; tenantId: string; membershipId: string },
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [context.userId]);
    await client.query("select set_config('app.tenant_id', $1, true)", [context.tenantId]);
    await client.query("select set_config('app.membership_id', $1, true)", [context.membershipId]);
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
