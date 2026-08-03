import { describe, expect, test, vi } from "vitest";
import {
  BootstrapSuperAdminService,
  ExistingSuperAdmin,
  SuperAdminAuthClient,
  SuperAdminBootstrapRepository,
} from "../../src/auth/bootstrap-super-admin.service";

const input = {
  fullName: "Platform Owner",
  email: "owner@example.com",
  password: "not-logged",
};

describe("BootstrapSuperAdminService", () => {
  test("creates the first Super Admin", async () => {
    const authClient = fakeAuthClient();
    const repository = fakeRepository();
    const service = new BootstrapSuperAdminService(authClient, repository);

    const result = await service.bootstrap(input);

    expect(result).toMatchObject({
      status: "created",
      email: "owner@example.com",
      authUserId: "77777777-7777-4777-8777-777777777777",
      applicationUserId: "33333333-3333-4333-8333-333333333333",
      assignedRole: "SUPER_ADMIN",
      tenantMembershipCount: 0,
      authUserCreated: true,
    });
    expect(authClient.createEmailPasswordUser).toHaveBeenCalledWith(input);
    expect(repository.createFirstSuperAdmin).toHaveBeenCalledWith({
      authUserId: "77777777-7777-4777-8777-777777777777",
      email: "owner@example.com",
      fullName: "Platform Owner",
    });
  });

  test("refuses when an active Super Admin already exists", async () => {
    const existing: ExistingSuperAdmin = {
      email: "existing@example.com",
      applicationUserId: "44444444-4444-4444-8444-444444444444",
      assignedRole: "SUPER_ADMIN",
    };
    const authClient = fakeAuthClient();
    const repository = fakeRepository(existing);
    const service = new BootstrapSuperAdminService(authClient, repository);

    const result = await service.bootstrap(input);

    expect(result).toEqual({ status: "already_exists", ...existing });
    expect(authClient.findUserByEmail).not.toHaveBeenCalled();
    expect(authClient.createEmailPasswordUser).not.toHaveBeenCalled();
    expect(repository.createFirstSuperAdmin).not.toHaveBeenCalled();
  });

  test("reuses an existing Supabase Auth user to prevent duplicates after partial failure", async () => {
    const authClient = fakeAuthClient({
      findResult: {
        id: "88888888-8888-4888-8888-888888888888",
        email: "owner@example.com",
      },
    });
    const repository = fakeRepository();
    const service = new BootstrapSuperAdminService(authClient, repository);

    const result = await service.bootstrap(input);

    expect(result).toMatchObject({
      status: "created",
      authUserId: "88888888-8888-4888-8888-888888888888",
      authUserCreated: false,
    });
    expect(authClient.createEmailPasswordUser).not.toHaveBeenCalled();
  });

  test("does not create a Supabase Auth user when the application user is not eligible", async () => {
    const authClient = fakeAuthClient();
    const repository = fakeRepository(undefined, new Error("The first Super Admin must not have tenant memberships."));
    const service = new BootstrapSuperAdminService(authClient, repository);

    await expect(service.bootstrap(input)).rejects.toThrow("must not have tenant memberships");
    expect(authClient.createEmailPasswordUser).not.toHaveBeenCalled();
    expect(repository.createFirstSuperAdmin).not.toHaveBeenCalled();
  });

  test("reports that no tenant membership was created", async () => {
    const service = new BootstrapSuperAdminService(fakeAuthClient(), fakeRepository());

    const result = await service.bootstrap(input);

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.tenantMembershipCount).toBe(0);
    }
  });
});

function fakeAuthClient(options: {
  readonly findResult?: Awaited<ReturnType<SuperAdminAuthClient["findUserByEmail"]>>;
} = {}): SuperAdminAuthClient {
  return {
    findUserByEmail: vi.fn().mockResolvedValue(options.findResult),
    createEmailPasswordUser: vi.fn().mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      email: "owner@example.com",
    }),
  };
}

function fakeRepository(
  existing?: ExistingSuperAdmin,
  preflightError?: Error,
): SuperAdminBootstrapRepository {
  return {
    findActiveSuperAdmin: vi.fn().mockResolvedValue(existing),
    assertApplicationUserCanBecomeFirstSuperAdmin: vi.fn().mockImplementation(async () => {
      if (preflightError) throw preflightError;
    }),
    createFirstSuperAdmin: vi.fn().mockImplementation(async (request) => ({
      status: "created",
      email: request.email,
      authUserId: request.authUserId,
      applicationUserId: "33333333-3333-4333-8333-333333333333",
      assignedRole: "SUPER_ADMIN",
      tenantMembershipCount: 0,
      authUserCreated: false,
    })),
  };
}
