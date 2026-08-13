import { describe, expect, test, vi } from "vitest";
import { PasswordService } from "../../src/auth/core/password.service";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminClientsRepository } from "../../src/platform/tenant-admin-clients.repository";
import { TenantAdminClientsService } from "../../src/platform/tenant-admin-clients.service";

describe("TenantAdminClientsService", () => {
  test("provisions a client portal credential with a local password hash", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ id: "client-1" }) } as unknown as TenantAdminClientsRepository;
    const passwords = { hash: vi.fn().mockResolvedValue("$argon2id$client-hash") } as unknown as PasswordService;
    const service = new TenantAdminClientsService(repository, passwords);
    const context: RequestContext = {
      requestId: "req-1", authUserId: "user-1", userId: "user-1", tenantId: "tenant-1", membershipId: "membership-1",
      roles: ["TENANT_OWNER"], permissions: ["client.create"], isPlatformAdmin: false,
    };

    await service.create(context, {
      displayName: "Client One", legalName: "Client One Ltd", code: "client-one", portalAccess: { email: " Client@Example.com ", phone: "", password: "client-password" },
    });

    expect(passwords.hash).toHaveBeenCalledWith("client-password");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", membershipId: "membership-1" }),
      expect.objectContaining({ portalAccess: expect.objectContaining({ email: "client@example.com" }) }),
      "$argon2id$client-hash",
    );
  });
});
