import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolClient } from "pg";
import * as schema from "./schema";

export type TrustedDatabaseContext = {
  readonly authUserId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly membershipId?: string;
  readonly employeeId?: string;
  readonly clientAccountId?: string;
  readonly isPlatformAdmin?: boolean;
  readonly supportAccessSessionId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
};

const createDrizzleClient = (client: PoolClient) => drizzle(client, { schema });
type TransactionDatabase = ReturnType<typeof createDrizzleClient>;

export async function withDatabaseTransaction<T>(
  pool: Pool,
  context: TrustedDatabaseContext,
  work: (tx: TransactionDatabase, client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await setTrustedDatabaseContext(client, context);
    const result = await work(createDrizzleClient(client), client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setTrustedDatabaseContext(
  client: PoolClient,
  context: TrustedDatabaseContext,
): Promise<void> {
  await client.query(
    `
    select
      set_config('app.is_platform_admin', $1, true),
      set_config('app.auth_user_id', $2, true),
      set_config('app.user_id', $3, true),
      set_config('app.tenant_id', $4, true),
      set_config('app.membership_id', $5, true),
      set_config('app.employee_id', $6, true),
      set_config('app.client_id', $7, true),
      set_config('app.support_access_session_id', $8, true),
      set_config('app.request_id', $9, true),
      set_config('app.ip_address', $10, true)
    `,
    [
      context.isPlatformAdmin ? "true" : "false",
      context.authUserId ?? "",
      context.userId ?? "",
      context.tenantId ?? "",
      context.membershipId ?? "",
      context.employeeId ?? "",
      context.clientAccountId ?? "",
      context.supportAccessSessionId ?? "",
      context.requestId ?? "",
      context.ipAddress ?? "",
    ],
  );
}
