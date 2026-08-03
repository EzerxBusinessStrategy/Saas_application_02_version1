import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool, QueryResult } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { runMigrations, migrationNames } from "../../src/database/migrations";
import { setTrustedDatabaseContext, TrustedDatabaseContext } from "../../src/database/transaction-context";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const userA = "33333333-3333-4333-8333-333333333333";
const userB = "44444444-4444-4444-8444-444444444444";
const userSuspended = "99999999-9999-4999-8999-999999999999";
const membershipA = "55555555-5555-4555-8555-555555555555";
const membershipB = "66666666-6666-4666-8666-666666666666";
const membershipSuspended = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const superAdminUser = "dddddddd-3333-4333-8333-333333333333";

describe("Phase 2 PostgreSQL foundation", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    pool = new Pool({ connectionString: container.getConnectionUri(), max: 4 });
    await runMigrations(pool);
    await seedTenants(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  test("applies migrations once in deterministic order and seed reruns do not duplicate", async () => {
    const rerun = await runMigrations(pool);
    expect(rerun.applied).toEqual([]);
    expect(rerun.skipped).toEqual([...migrationNames]);

    const migrations = await pool.query<{ name: string }>(
      "select name from private.schema_migrations order by name",
    );
    expect(migrations.rows.map((row) => row.name)).toEqual([...migrationNames]);

    const counts = await pool.query<{ roles: string; permissions: string; grants: string }>(`
      select
        (select count(*) from public.roles)::text as roles,
        (select count(*) from public.permissions)::text as permissions,
        (select count(*) from public.role_permissions)::text as grants
    `);
    expect(counts.rows[0]).toEqual({ roles: "8", permissions: "33", grants: "79" });
    await expect(
      pool.query(
        `insert into public.platform_user_roles (user_id, role_id)
         select $1, id from public.roles where code = 'TENANT_ADMIN'`,
        [superAdminUser],
      ),
    ).rejects.toThrow();
  });

  test("runtime role is non-owner and cannot bypass RLS", async () => {
    const role = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean }>(
      "select rolsuper, rolbypassrls, rolcreatedb from pg_roles where rolname = 'app_runtime'",
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreatedb: false });

    const owners = await pool.query<{ owned_tables: string }>(`
      select count(*)::text as owned_tables
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles r on r.oid = c.relowner
      where r.rolname = 'app_runtime'
        and n.nspname in ('public', 'audit')
        and c.relkind = 'r'
    `);
    expect(owners.rows[0]?.owned_tables).toBe("0");
  });

  test("Tenant A can read only its own active membership", async () => {
    const visible = await asRuntime<{ id: string }>(
      pool,
      tenantAContext(),
      "select id from public.tenant_memberships order by id",
    );
    expect(visible.rows.map((row) => row.id)).toEqual([membershipA]);
  });

  test("Tenant A cannot update or delete Tenant B memberships", async () => {
    await expect(
      asRuntime(
        pool,
        tenantAContext(),
        "update public.tenant_memberships set display_name = 'Blocked' where id = $1",
        [membershipB],
      ),
    ).rejects.toThrow();

    await expect(
      asRuntime(pool, tenantAContext(), "delete from public.tenant_memberships where id = $1", [
        membershipB,
      ]),
    ).rejects.toThrow();
  });

  test("missing tenant context denies tenant-owned reads", async () => {
    const result = await asRuntime<{ total: string }>(
      pool,
      { userId: userA, membershipId: membershipA },
      "select count(*)::text as total from public.tenant_memberships",
    );
    expect(result.rows[0]?.total).toBe("0");
  });

  test("runtime inserts cannot spoof another tenant", async () => {
    await expect(
      asRuntime(
        pool,
        tenantAContext(),
        `insert into public.tenant_memberships (tenant_id, user_id, display_name)
         values ($1, $2, 'Spoofed')`,
        [tenantB, userA],
      ),
    ).rejects.toThrow();
  });

  test("runtime cannot directly mutate tenant, membership, or role assignments", async () => {
    await expect(
      asRuntime(
        pool,
        tenantAContext(),
        "update public.tenant_memberships set tenant_id = $1 where id = $2",
        [tenantB, membershipA],
      ),
    ).rejects.toThrow();

    await expect(
      asRuntime(pool, tenantAContext(), "update public.tenants set display_name = 'Changed'"),
    ).rejects.toThrow();

    const role = await pool.query<{ id: string }>(
      "select id from public.roles where code = 'TENANT_ADMIN'",
    );
    await expect(
      asRuntime(
        pool,
        tenantAContext(),
        `insert into public.membership_roles (tenant_id, membership_id, role_id)
         values ($1, $2, $3)`,
        [tenantA, membershipA, role.rows[0]?.id],
      ),
    ).rejects.toThrow();
  });

  test("composite foreign keys reject cross-tenant role assignments", async () => {
    const role = await pool.query<{ id: string }>(
      "select id from public.roles where code = 'TENANT_ADMIN'",
    );
    await expect(
      pool.query(
        `insert into public.membership_roles (tenant_id, membership_id, role_id)
         values ($1, $2, $3)`,
        [tenantA, membershipB, role.rows[0]?.id],
      ),
    ).rejects.toThrow();
  });

  test("wrong, suspended, and fake support context cannot read tenant memberships", async () => {
    const wrongPairing = await asRuntime<{ total: string }>(
      pool,
      { ...tenantAContext(), membershipId: membershipB },
      "select count(*)::text as total from public.tenant_memberships",
    );
    expect(wrongPairing.rows[0]?.total).toBe("0");

    const suspended = await asRuntime<{ total: string }>(
      pool,
      {
        userId: userSuspended,
        tenantId: tenantA,
        membershipId: membershipSuspended,
        isPlatformAdmin: false,
      },
      "select count(*)::text as total from public.tenant_memberships",
    );
    expect(suspended.rows[0]?.total).toBe("0");

    const fakeSupport = await asRuntime<{ total: string }>(
      pool,
      {
        userId: userA,
        tenantId: tenantA,
        membershipId: membershipA,
        isPlatformAdmin: true,
        supportAccessSessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      "select count(*)::text as total from public.tenant_memberships where id = $1",
      [membershipB],
    );
    expect(fakeSupport.rows[0]?.total).toBe("0");
  });

  test("runtime can write audit only through append-only function", async () => {
    const created = await asRuntime<{ id: string }>(
      pool,
      tenantAContext(),
      "select audit.write_audit_event('tenant.updated', 'tenant', $1, 'succeeded') as id",
      [tenantA],
    );
    const auditId = created.rows[0]?.id;
    expect(auditId).toMatch(/[0-9a-f-]{36}/);

    await expect(
      asRuntime(
        pool,
        tenantAContext(),
        "update audit.audit_events set reason = 'tampered' where id = $1",
        [auditId],
      ),
    ).rejects.toThrow();

    await expect(
      asRuntime(pool, tenantAContext(), "delete from audit.audit_events where id = $1", [auditId]),
    ).rejects.toThrow();
  });

  test("runtime can resolve verified Supabase auth subject into roles and permissions", async () => {
    await pool.query(
      `insert into public.membership_roles (tenant_id, membership_id, role_id)
       select $1, $2, id from public.roles where code = 'TENANT_ADMIN'
       on conflict do nothing`,
      [tenantA, membershipA],
    );

    const resolved = await asRuntime<{
      user_id: string;
      tenant_id: string;
      membership_id: string;
      role_codes: string[];
      permission_codes: string[];
    }>(
      pool,
      tenantAContext(),
      "select user_id, tenant_id, membership_id, role_codes, permission_codes from private.resolve_auth_context($1::uuid)",
      ["77777777-7777-4777-8777-777777777777"],
    );

    expect(resolved.rows[0]).toMatchObject({
      user_id: userA,
      tenant_id: tenantA,
      membership_id: membershipA,
      role_codes: ["TENANT_ADMIN"],
    });
    expect(resolved.rows[0]?.permission_codes).toContain("client.read");
  });

  test("runtime cannot resolve a different Supabase auth subject", async () => {
    const resolved = await asRuntime<{ total: string }>(
      pool,
      tenantAContext(),
      "select count(*)::text as total from private.resolve_auth_context($1::uuid)",
      ["88888888-8888-4888-8888-888888888888"],
    );

    expect(resolved.rows[0]?.total).toBe("0");
  });

  test("runtime can resolve platform Super Admin without tenant membership", async () => {
    await pool.query(
      `insert into public.platform_user_roles (user_id, role_id)
       select $1, id from public.roles where code = 'SUPER_ADMIN'
       on conflict do nothing`,
      [superAdminUser],
    );

    const resolved = await asRuntime<{
      user_id: string;
      tenant_id: string | null;
      membership_id: string | null;
      role_codes: string[];
      permission_codes: string[];
    }>(
      pool,
      {
        authUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        userId: superAdminUser,
        isPlatformAdmin: true,
        requestId: "phase2-platform-test-request",
      },
      "select user_id, tenant_id, membership_id, role_codes, permission_codes from private.resolve_auth_context($1::uuid)",
      ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    );

    expect(resolved.rows[0]).toMatchObject({
      user_id: superAdminUser,
      tenant_id: null,
      membership_id: null,
      role_codes: ["SUPER_ADMIN"],
    });
    expect(resolved.rows[0]?.permission_codes).toContain("tenant.create");
  });

  test("transaction-local context is cleared after commit", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role app_runtime");
      await setTrustedDatabaseContext(client, tenantAContext());
      await client.query("commit");
      const afterCommit = await client.query<{ tenant_id: string | null }>(
        "select nullif(current_setting('app.tenant_id', true), '') as tenant_id",
      );
      expect(afterCommit.rows[0]?.tenant_id).toBeNull();
    } finally {
      client.release();
    }
  });
});

async function seedTenants(pool: Pool): Promise<void> {
  await pool.query(
    `insert into public.tenants (id, code, legal_name, display_name, status, country, currency, timezone)
     values
       ($1, 'tenant-a', 'Tenant A Legal', 'Tenant A', 'active', 'IN', 'INR', 'Asia/Kolkata'),
       ($2, 'tenant-b', 'Tenant B Legal', 'Tenant B', 'active', 'IN', 'INR', 'Asia/Kolkata')`,
    [tenantA, tenantB],
  );
  await pool.query(
    `insert into public.users (id, supabase_auth_user_id, email, email_normalized, display_name, status)
     values
       ($1, '77777777-7777-4777-8777-777777777777', 'user-a@example.com', 'user-a@example.com', 'User A', 'active'),
       ($2, '88888888-8888-4888-8888-888888888888', 'user-b@example.com', 'user-b@example.com', 'User B', 'active'),
       ($3, '99999999-9999-4999-8999-999999999999', 'user-suspended@example.com', 'user-suspended@example.com', 'Suspended User', 'suspended'),
       ($4, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'super-admin@example.com', 'super-admin@example.com', 'Super Admin', 'active')`,
    [userA, userB, userSuspended, superAdminUser],
  );
  await pool.query(
    `insert into public.tenant_memberships (id, tenant_id, user_id, display_name, status)
     values
       ($1, $2, $3, 'User A Tenant A', 'active'),
       ($4, $5, $6, 'User B Tenant B', 'active'),
       ($7, $8, $9, 'Suspended User Tenant A', 'suspended')`,
    [
      membershipA,
      tenantA,
      userA,
      membershipB,
      tenantB,
      userB,
      membershipSuspended,
      tenantA,
      userSuspended,
    ],
  );
}

async function asRuntime<T extends object>(
  pool: Pool,
  context: TrustedDatabaseContext,
  sql: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role app_runtime");
    await setTrustedDatabaseContext(client, context);
    const result = await client.query<T>(sql, [...values]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function tenantAContext(): TrustedDatabaseContext {
  return {
    authUserId: "77777777-7777-4777-8777-777777777777",
    userId: userA,
    tenantId: tenantA,
    membershipId: membershipA,
    isPlatformAdmin: false,
    requestId: "phase2-test-request",
  };
}
