import { Pool } from "pg";
import { loadAppConfig } from "../config/app-config";
import { PasswordService } from "../auth/core/password.service";

async function main(): Promise<void> {
  const email = requiredEnv("PORTAL_SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const password = requiredEnv("PORTAL_SUPER_ADMIN_PASSWORD");
  const displayName = process.env.PORTAL_SUPER_ADMIN_NAME?.trim() || email.split("@")[0] || "Super Admin";
  const config = loadAppConfig();
  if (!config.databaseMigrationUrl) throw new Error("BACKEND_DATABASE_MIGRATION_URL is required.");
  const pool = new Pool({ connectionString: config.databaseMigrationUrl, max: 1, application_name: "saas-app-portal-auth-bootstrap" });
  try {
    await pool.query("begin");
    const role = await pool.query<{ id: string }>("select id::text from public.roles where code = 'SUPER_ADMIN' and scope = 'platform'");
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error("SUPER_ADMIN platform role is missing.");
    const existing = await pool.query<{ id: string }>("select id::text from public.users where email_normalized = $1 for update", [email]);
    const userId = existing.rows[0]?.id ?? (await pool.query<{ id: string }>(
      `insert into public.users (email, email_normalized, display_name, status)
       values ($1, $1, $2, 'active') returning id::text`,
      [email, displayName],
    )).rows[0]?.id;
    if (!userId) throw new Error("Super Admin application user could not be created.");
    const tenantMembership = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from public.tenant_memberships where user_id = $1::uuid and status <> 'removed') as exists",
      [userId],
    );
    if (tenantMembership.rows[0]?.exists) throw new Error("A tenant member cannot be bootstrapped as a Super Admin.");
    await pool.query("update public.users set display_name = $2, status = 'active', updated_at = now() where id = $1::uuid", [userId, displayName]);
    await pool.query(
      `insert into public.platform_user_roles (user_id, role_id, role_scope, status)
       values ($1::uuid, $2::uuid, 'platform', 'active')
       on conflict (user_id, role_id) do update set status = 'active', revoked_at = null`,
      [userId, roleId],
    );
    const passwordHash = await new PasswordService().hash(password);
    await pool.query(
      `insert into authn.credentials (portal_type, user_id, email, email_normalized, password_hash, status, password_changed_at)
       values ('SUPER_ADMIN', $1::uuid, $2, $2, $3, 'ACTIVE', now())
       on conflict (email_normalized) do update set password_hash = excluded.password_hash, status = 'ACTIVE', password_changed_at = now(), failed_login_attempts = 0, locked_until = null`,
      [userId, email, passwordHash],
    );
    await pool.query("commit");
    process.stdout.write("Portal Super Admin credential is active.\n");
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Portal Super Admin bootstrap failed."}\n`);
  process.exitCode = 1;
});
