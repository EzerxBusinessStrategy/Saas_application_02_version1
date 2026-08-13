import { expect, test } from "vitest";
import { OpaqueSessionTokenService } from "../../src/auth/core/opaque-session-token.service";
import { PasswordService } from "../../src/auth/core/password.service";
import { portalSessionPolicy } from "../../src/auth/core/portal-auth.types";

test("stores Argon2id hashes and verifies only the submitted password", async () => {
  const passwords = new PasswordService();
  const hash = await passwords.hash("a-long-enough-test-password");
  expect(hash.startsWith("$argon2id$")).toBe(true);
  await expect(passwords.verify(hash, "a-long-enough-test-password")).resolves.toBe(true);
  await expect(passwords.verify(hash, "wrong-password")).resolves.toBe(false);
});

test("generates opaque tokens and persists a deterministic SHA-256 lookup hash", () => {
  const tokens = new OpaqueSessionTokenService();
  const token = tokens.create();
  expect(token).toHaveLength(43);
  expect(tokens.hash(token)).toMatch(/^[a-f0-9]{64}$/);
  expect(tokens.hash(token)).toBe(tokens.hash(token));
});

test("uses portal-specific absolute and inactivity session limits", () => {
  expect(portalSessionPolicy("SUPER_ADMIN")).toEqual({ expiresInMs: 7_200_000, idleTimeoutMs: 1_800_000 });
  expect(portalSessionPolicy("TENANT")).toEqual({ expiresInMs: 28_800_000, idleTimeoutMs: 3_600_000 });
  expect(portalSessionPolicy("EMPLOYEE")).toEqual({ expiresInMs: 28_800_000 });
  expect(portalSessionPolicy("CLIENT")).toEqual({ expiresInMs: 86_400_000 });
});
