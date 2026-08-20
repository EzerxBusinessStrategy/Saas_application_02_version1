import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { SuperAdminDashboardRepository } from "../../src/platform/super-admin-dashboard.repository";

describe("SuperAdminDashboardRepository", () => {
  it("derives Tenant Administrator login state from portal credentials", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new SuperAdminDashboardRepository(null);

    await (
      repository as unknown as {
        getTenantRows: (
          client: PoolClient,
          filters: Record<string, never>,
          options: { includeSearch: boolean; includeStatus: boolean },
        ) => Promise<unknown>;
      }
    ).getTenantRows({ query } as unknown as PoolClient, {}, {
      includeSearch: true,
      includeStatus: true,
    });

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("max(greatest(c.last_login_at, u.last_login_at, tm.last_access_at, s.last_seen_at)) as last_login_at");
    expect(sql).toContain("left join authn.credentials c on c.user_id = tm.user_id");
    expect(sql).toContain("left join authn.sessions s");
    expect(sql).not.toContain("c.portal_type = 'TENANT'");
    expect(sql).not.toContain("TENANT_ADMIN_LOGGED_IN");
  });
});
