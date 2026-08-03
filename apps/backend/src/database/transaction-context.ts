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
  const settings: Record<string, string> = {
    "app.is_platform_admin": context.isPlatformAdmin ? "true" : "false",
  };
  if (context.authUserId) settings["app.auth_user_id"] = context.authUserId;
  if (context.userId) settings["app.user_id"] = context.userId;
  if (context.tenantId) settings["app.tenant_id"] = context.tenantId;
  if (context.membershipId) settings["app.membership_id"] = context.membershipId;
  if (context.employeeId) settings["app.employee_id"] = context.employeeId;
  if (context.clientAccountId) settings["app.client_id"] = context.clientAccountId;
  if (context.supportAccessSessionId) {
    settings["app.support_access_session_id"] = context.supportAccessSessionId;
  }
  if (context.requestId) settings["app.request_id"] = context.requestId;

  for (const [key, value] of Object.entries(settings)) {
    await client.query("select set_config($1, $2, true)", [key, value]);
  }
}
