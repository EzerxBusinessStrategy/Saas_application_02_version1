import { ForbiddenException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { type ClientPortalRequestContext, resolveClientPortalScope } from "../../src/platform/client-portal-context";

const context = {
  requestId: "request-1",
  authUserId: "auth-user-1",
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  clientAccountId: "client-account-1",
  roles: ["CLIENT_USER"],
  permissions: [],
  isPlatformAdmin: false,
} as ClientPortalRequestContext;

describe("client portal scope", () => {
  test("derives the business client from the authenticated active portal account", async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [{ client_id: "client-1" }] })),
    };

    await expect(resolveClientPortalScope(client as never, context)).resolves.toMatchObject({
      clientId: "client-1",
      clientAccountId: "client-account-1",
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("from public.client_portal_accounts"),
      ["tenant-1", "client-account-1", "user-1", "membership-1"],
    );
  });

  test("rejects an inactive or mismatched portal account", async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })) };

    await expect(resolveClientPortalScope(client as never, context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
