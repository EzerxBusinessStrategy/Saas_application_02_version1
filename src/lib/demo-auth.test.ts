import { expect, test } from "vitest";
import {
  demoPassword,
  internalDemoEmail,
  isWorkspaceAllowed,
  roleFromSession,
  validateDemoLogin,
} from "@/lib/demo-auth";

test("validates the approved demo credentials for every portal role", () => {
  expect(
    validateDemoLogin({
      identifier: internalDemoEmail,
      password: demoPassword,
      role: "MANAGER",
    }),
  ).toEqual({ role: "MANAGER", workspace: "manager" });
  expect(
    validateDemoLogin({
      identifier: internalDemoEmail,
      password: demoPassword,
      role: "CLIENT_USER",
    }),
  ).toEqual({ role: "CLIENT_USER", workspace: "client" });
  expect(
    validateDemoLogin({
      identifier: internalDemoEmail,
      password: "wrong",
      role: "EMPLOYEE",
    }),
  ).toBeNull();
});

test("does not allow Super Admin to use demo credentials", () => {
  expect(
    validateDemoLogin({
      identifier: internalDemoEmail,
      password: demoPassword,
      role: "SUPER_ADMIN",
    }),
  ).toBeNull();
  expect(roleFromSession("SUPER_ADMIN")).toBeNull();
});

test("limits every demo role to its own workspace", () => {
  expect(isWorkspaceAllowed("SUPER_ADMIN", "super-admin")).toBe(true);
  expect(isWorkspaceAllowed("CLIENT_USER", "admin")).toBe(false);
});
