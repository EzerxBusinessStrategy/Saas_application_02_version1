import { describe, expect, it } from "vitest";
import { avatarObjectKey, isOwnedAvatarPath, isWebpImage } from "../../src/auth/user-avatar.util";

describe("user avatar paths", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const objectId = "22222222-2222-4222-8222-222222222222";
  const tenantId = "33333333-3333-4333-8333-333333333333";

  it("stores tenant photos under tenant/user/uuid.webp", () => {
    expect(avatarObjectKey({ tenantId, userId, objectId })).toBe(
      `${tenantId}/${userId}/${objectId}.webp`,
    );
  });

  it("stores Super Admin photos under platform/user/uuid.webp", () => {
    expect(avatarObjectKey({ userId, objectId })).toBe(`platform/${userId}/${objectId}.webp`);
  });

  it("accepts only the authenticated user's object key", () => {
    const path = avatarObjectKey({ tenantId, userId, objectId });
    expect(isOwnedAvatarPath(path, userId)).toBe(true);
    expect(isOwnedAvatarPath(path, objectId)).toBe(false);
    expect(isOwnedAvatarPath("not-a-path", userId)).toBe(false);
  });

  it("rejects non-webp magic bytes", () => {
    expect(isWebpImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });
});
