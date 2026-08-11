import { describe, expect, test, vi } from "vitest";
import { Pool } from "pg";
import { SessionPolicyRepository } from "../../src/auth/session-policy.repository";

describe("SessionPolicyRepository", () => {
  test("inherits the user's current authorization-context version for a new session", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          remember_me: false,
          absolute_expires_at: new Date("2026-08-11T00:00:00.000Z"),
          created: true,
        }],
      })
      .mockResolvedValueOnce({});
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const repository = new SessionPolicyRepository(pool);

    await repository.createOrRefresh(
      {
        requestId: "test-request-id",
        authUserId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        tenantId: "33333333-3333-4333-8333-333333333333",
        membershipId: "44444444-4444-4444-8444-444444444444",
        roles: ["TENANT_ADMIN"],
        permissions: [],
        isPlatformAdmin: false,
      },
      "session-id",
      false,
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("coalesce(\n            (select max(policy.auth_context_version)"),
      ["22222222-2222-4222-8222-222222222222", "session-id", false],
    );
  });
});
