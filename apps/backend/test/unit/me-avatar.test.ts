import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeService } from "../../src/auth/me.service";
import type { RequestContext } from "../../src/auth/request-context";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "33333333-3333-4333-8333-333333333333";

const context: RequestContext = {
  requestId: "req-1",
  authUserId: "auth-1",
  userId,
  tenantId,
  membershipId: "mem-1",
  roles: ["EMPLOYEE"],
  permissions: [],
  isPlatformAdmin: false,
};

const userRow = {
  user_id: userId,
  user_email: "ada@example.com",
  user_display_name: "Ada",
  user_status: "active",
  tenant_id: tenantId,
  tenant_code: "ada",
  tenant_display_name: "Ada Tenant",
  tenant_status: "active",
  membership_id: "mem-1",
  membership_status: "active",
  membership_display_name: "Ada",
  membership_timezone: "Asia/Kolkata",
  role_codes: ["EMPLOYEE"],
  permission_codes: [],
};

describe("MeService avatars", () => {
  const repository = {
    findByApplicationUserId: vi.fn(),
    updateDisplayName: vi.fn(),
    getUserPhone: vi.fn(),
    listCurrentUserContexts: vi.fn(),
    updateOwnProfile: vi.fn(),
    updateOwnMembershipDisplayTitle: vi.fn(),
  };
  const preferences = {
    getOrCreate: vi.fn(),
    update: vi.fn(),
  };
  const avatars = {
    getPath: vi.fn(),
    replacePath: vi.fn(),
  };
  const storage = {
    uploadWebp: vi.fn(),
    createSignedUrl: vi.fn(),
    removeObject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findByApplicationUserId.mockResolvedValue([userRow]);
    preferences.getOrCreate.mockResolvedValue({ locale: "en", timezone: "Asia/Kolkata" });
    avatars.getPath.mockResolvedValue(null);
    storage.createSignedUrl.mockResolvedValue("https://signed.example/avatar.webp");
    repository.getUserPhone.mockResolvedValue(null);
  });

  it("returns a signed avatar URL from /me when a path is stored", async () => {
    avatars.getPath.mockResolvedValue(`${tenantId}/${userId}/22222222-2222-4222-8222-222222222222.webp`);
    const service = new MeService(repository as never, preferences as never, avatars as never, storage as never);
    const result = await service.getMe(context);
    expect(result.user.avatarUrl).toBe("https://signed.example/avatar.webp");
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      `${tenantId}/${userId}/22222222-2222-4222-8222-222222222222.webp`,
      userId,
    );
  });

  it("rejects a non-webp payload before storage upload", async () => {
    const service = new MeService(repository as never, preferences as never, avatars as never, storage as never);
    await expect(service.updateAvatar(context, Buffer.from("not-webp").toString("base64"))).rejects.toMatchObject({
      response: { code: "AVATAR_TYPE_INVALID" },
    });
    expect(storage.uploadWebp).not.toHaveBeenCalled();
  });
});
