import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Pool, PoolClient } from "pg";

export type BootstrapSuperAdminInput = {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
};

export type BootstrapSuperAdminResult =
  | {
      readonly status: "created";
      readonly email: string;
      readonly authUserId: string;
      readonly applicationUserId: string;
      readonly assignedRole: "SUPER_ADMIN";
      readonly tenantMembershipCount: number;
      readonly authUserCreated: boolean;
    }
  | {
      readonly status: "already_exists";
      readonly email: string;
      readonly applicationUserId: string;
      readonly assignedRole: "SUPER_ADMIN";
    };

export type ExistingSuperAdmin = {
  readonly email: string;
  readonly applicationUserId: string;
  readonly assignedRole: "SUPER_ADMIN";
};

export type SupabaseAuthUser = {
  readonly id: string;
  readonly email: string;
};

export interface SuperAdminAuthClient {
  findUserByEmail(email: string): Promise<SupabaseAuthUser | undefined>;
  createEmailPasswordUser(input: BootstrapSuperAdminInput): Promise<SupabaseAuthUser>;
}

export interface SuperAdminBootstrapRepository {
  findActiveSuperAdmin(): Promise<ExistingSuperAdmin | undefined>;
  assertApplicationUserCanBecomeFirstSuperAdmin(input: {
    readonly email: string;
    readonly authUserId?: string;
  }): Promise<void>;
  createFirstSuperAdmin(input: {
    readonly authUserId: string;
    readonly email: string;
    readonly fullName: string;
  }): Promise<BootstrapSuperAdminResult>;
}

export class PartialSuperAdminBootstrapError extends Error {
  constructor(
    readonly email: string,
    readonly authUserId: string,
    cause: unknown,
  ) {
    super(`Supabase Auth user was created or found, but application bootstrap failed: ${safeMessage(cause)}`);
    this.name = "PartialSuperAdminBootstrapError";
  }
}

export class BootstrapSuperAdminService {
  constructor(
    private readonly authClient: SuperAdminAuthClient,
    private readonly repository: SuperAdminBootstrapRepository,
  ) {}

  async bootstrap(input: BootstrapSuperAdminInput): Promise<BootstrapSuperAdminResult> {
    const normalized = normalizeInput(input);
    const existing = await this.repository.findActiveSuperAdmin();
    if (existing) {
      return { status: "already_exists", ...existing };
    }

    let authUser = await this.authClient.findUserByEmail(normalized.email);
    await this.repository.assertApplicationUserCanBecomeFirstSuperAdmin({
      email: normalized.email,
      authUserId: authUser?.id,
    });
    let authUserCreated = false;
    if (!authUser) {
      authUser = await this.authClient.createEmailPasswordUser(normalized);
      authUserCreated = true;
    }

    try {
      const result = await this.repository.createFirstSuperAdmin({
        authUserId: authUser.id,
        email: normalized.email,
        fullName: normalized.fullName,
      });
      return result.status === "created" ? { ...result, authUserCreated } : result;
    } catch (error) {
      throw new PartialSuperAdminBootstrapError(normalized.email, authUser.id, error);
    }
  }
}

export class SupabaseAdminAuthClient implements SuperAdminAuthClient {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, adminKey: string) {
    this.client = createClient(supabaseUrl, adminKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async findUserByEmail(email: string): Promise<SupabaseAuthUser | undefined> {
    const normalizedEmail = normalizeEmail(email);
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`Supabase Auth user lookup failed: ${error.message}`);
      const users = data.users ?? [];
      const found = users.find((user) => normalizeEmail(user.email ?? "") === normalizedEmail);
      if (found) return userFromSupabase(found);
      if (users.length < 1000) return undefined;
    }
    throw new Error("Supabase Auth user lookup reached the page limit.");
  }

  async createEmailPasswordUser(input: BootstrapSuperAdminInput): Promise<SupabaseAuthUser> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: normalizeEmail(input.email),
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        name: input.fullName,
      },
    });
    if (error) throw new Error(`Supabase Auth user creation failed: ${error.message}`);
    if (!data.user) throw new Error("Supabase Auth did not return the created user.");
    return userFromSupabase(data.user);
  }
}

export class PgSuperAdminBootstrapRepository implements SuperAdminBootstrapRepository {
  constructor(private readonly pool: Pool) {}

  async findActiveSuperAdmin(): Promise<ExistingSuperAdmin | undefined> {
    const result = await this.pool.query<{
      email: string;
      application_user_id: string;
    }>(activeSuperAdminSql);
    const row = result.rows[0];
    return row
      ? {
          email: row.email,
          applicationUserId: row.application_user_id,
          assignedRole: "SUPER_ADMIN",
        }
      : undefined;
  }

  async assertApplicationUserCanBecomeFirstSuperAdmin(input: {
    readonly email: string;
    readonly authUserId?: string;
  }): Promise<void> {
    const user = await findApplicationUserByEmailOrAuthUserId(this.pool, input);
    if (!user) return;
    if (!input.authUserId) {
      throw new Error("Application user already exists, but matching Supabase Auth user was not found.");
    }
    assertSameApplicationUser(user, input.email, input.authUserId);
    await assertNoTenantMemberships(this.pool, user.id);
  }

  async createFirstSuperAdmin(input: {
    readonly authUserId: string;
    readonly email: string;
    readonly fullName: string;
  }): Promise<BootstrapSuperAdminResult> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('bootstrap:first-super-admin'))");

      const existing = await findActiveSuperAdmin(client);
      if (existing) {
        await client.query("commit");
        return { status: "already_exists", ...existing };
      }

      const userId = await upsertApplicationUser(client, input);
      await assertNoTenantMemberships(client, userId);
      const roleId = await superAdminRoleId(client);
      await client.query(
        `insert into public.platform_user_roles (user_id, role_id, status)
         values ($1, $2, 'active')
         on conflict (user_id, role_id) do update
         set status = 'active',
             assigned_at = now(),
             revoked_at = null`,
        [userId, roleId],
      );
      const bootstrapRequestId = randomUUID();
      await client.query(
        `insert into audit.audit_events (
           tenant_id,
           actor_user_id,
           actor_membership_id,
           action,
           resource_type,
           resource_id,
           result,
           reason,
           request_id,
           metadata
         )
         values (
           null,
           $1,
           null,
           'PLATFORM_SUPER_ADMIN_BOOTSTRAPPED',
           'user',
           $1,
           'succeeded',
           'one-time first Super Admin bootstrap',
           $2,
           jsonb_build_object('role', 'SUPER_ADMIN', 'source', 'backend_cli')
         )`,
        [userId, bootstrapRequestId],
      );
      const tenantMembershipCount = await countTenantMemberships(client, userId);
      await client.query("commit");
      return {
        status: "created",
        email: normalizeEmail(input.email),
        authUserId: input.authUserId,
        applicationUserId: userId,
        assignedRole: "SUPER_ADMIN",
        tenantMembershipCount,
        authUserCreated: false,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function normalizeInput(input: BootstrapSuperAdminInput): BootstrapSuperAdminInput {
  return {
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    password: input.password,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userFromSupabase(user: User): SupabaseAuthUser {
  if (!user.email) throw new Error("Supabase Auth user is missing an email.");
  return { id: user.id, email: normalizeEmail(user.email) };
}

const activeSuperAdminSql = `
  select u.email, u.id as application_user_id
  from public.users u
  join public.platform_user_roles pur on pur.user_id = u.id
  join public.roles r on r.id = pur.role_id
  where u.status = 'active'
    and pur.status = 'active'
    and r.code = 'SUPER_ADMIN'
    and r.scope = 'platform'
  order by pur.assigned_at
  limit 1
`;

async function findActiveSuperAdmin(client: PoolClient): Promise<ExistingSuperAdmin | undefined> {
  const result = await client.query<{ email: string; application_user_id: string }>(activeSuperAdminSql);
  const row = result.rows[0];
  return row
    ? {
        email: row.email,
        applicationUserId: row.application_user_id,
        assignedRole: "SUPER_ADMIN",
      }
    : undefined;
}

async function upsertApplicationUser(
  client: PoolClient,
  input: { readonly authUserId: string; readonly email: string; readonly fullName: string },
): Promise<string> {
  const email = normalizeEmail(input.email);
  const existing = await client.query<{
    id: string;
    supabase_auth_user_id: string;
    email_normalized: string;
  }>(
    `select id, supabase_auth_user_id, email_normalized
     from public.users
     where supabase_auth_user_id = $1::uuid
        or email_normalized = $2
     for update`,
    [input.authUserId, email],
  );
  const row = existing.rows[0];
  if (row) {
    if (row.supabase_auth_user_id !== input.authUserId || row.email_normalized !== email) {
      throw new Error("Application user conflicts with an existing Supabase Auth mapping.");
    }
    await client.query(
      `update public.users
       set display_name = $2,
           status = 'active',
           updated_at = now()
       where id = $1::uuid`,
      [row.id, input.fullName],
    );
    return row.id;
  }

  const inserted = await client.query<{ id: string }>(
    `insert into public.users (
       supabase_auth_user_id,
       email,
       email_normalized,
       display_name,
       status
     )
     values ($1::uuid, $2, $2, $3, 'active')
     returning id`,
    [input.authUserId, email, input.fullName],
  );
  const insertedRow = inserted.rows[0];
  if (!insertedRow) throw new Error("Application user insert did not return an ID.");
  return insertedRow.id;
}

async function findApplicationUserByEmailOrAuthUserId(
  client: Pool | PoolClient,
  input: { readonly email: string; readonly authUserId?: string },
): Promise<
  | {
      readonly id: string;
      readonly supabase_auth_user_id: string;
      readonly email_normalized: string;
    }
  | undefined
> {
  const email = normalizeEmail(input.email);
  const result = await client.query<{
    id: string;
    supabase_auth_user_id: string;
    email_normalized: string;
  }>(
    `select id, supabase_auth_user_id, email_normalized
     from public.users
     where email_normalized = $1
        or ($2::uuid is not null and supabase_auth_user_id = $2::uuid)
     limit 1`,
    [email, input.authUserId ?? null],
  );
  return result.rows[0];
}

function assertSameApplicationUser(
  user: { readonly supabase_auth_user_id: string; readonly email_normalized: string },
  email: string,
  authUserId: string,
): void {
  if (user.supabase_auth_user_id !== authUserId || user.email_normalized !== normalizeEmail(email)) {
    throw new Error("Application user conflicts with an existing Supabase Auth mapping.");
  }
}

async function superAdminRoleId(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    "select id from public.roles where code = 'SUPER_ADMIN' and scope = 'platform'",
  );
  const row = result.rows[0];
  if (!row) throw new Error("SUPER_ADMIN platform role is missing.");
  return row.id;
}

async function assertNoTenantMemberships(client: Pool | PoolClient, userId: string): Promise<void> {
  const total = await countTenantMemberships(client, userId);
  if (total > 0) {
    throw new Error("The first Super Admin must not have tenant memberships.");
  }
}

async function countTenantMemberships(client: Pool | PoolClient, userId: string): Promise<number> {
  const result = await client.query<{ total: string }>(
    "select count(*)::text as total from public.tenant_memberships where user_id = $1::uuid",
    [userId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
