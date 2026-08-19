const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const;

export const AVATAR_BUCKET = "avatars";
export const AVATAR_CONTENT_TYPE = "image/webp";
export const MAX_AVATAR_BYTES = 1024 * 1024;
export const AVATAR_SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

export function avatarObjectKey(input: {
  readonly tenantId?: string;
  readonly userId: string;
  readonly objectId: string;
}): string {
  const scope = input.tenantId ?? "platform";
  return `${scope}/${input.userId}/${input.objectId}.webp`;
}

export function isOwnedAvatarPath(path: string, userId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [scope, ownerId, fileName] = parts;
  if (!scope || !ownerId || !fileName) return false;
  if (scope !== "platform" && !UUID.test(scope)) return false;
  if (ownerId.toLowerCase() !== userId.toLowerCase()) return false;
  return fileName.toLowerCase().endsWith(".webp") && UUID.test(fileName.slice(0, -5));
}

export function isWebpImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const matches = (expected: readonly number[], offset: number) =>
    expected.every((byte, index) => bytes[offset + index] === byte);
  return matches(WEBP_RIFF, 0) && matches(WEBP_TAG, 8);
}
