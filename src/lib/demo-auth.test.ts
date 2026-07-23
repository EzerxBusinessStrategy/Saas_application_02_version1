import { expect, test } from "vitest";
import {
  clientDemoUserId,
  demoPassword,
  internalDemoEmail,
  isWorkspaceAllowed,
  validateDemoLogin,
} from "@/lib/demo-auth";

test("validates the approved internal and client demo credentials", () => {
  expect(
    validateDemoLogin({
      identifier: internalDemoEmail,
      password: demoPassword,
      role: "MANAGER",
    }),
  ).toEqual({ role: "MANAGER", workspace: "manager" });
  expect(
    validateDemoLogin({
      identifier: clientDemoUserId,
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

test("limits every demo role to its own workspace", () => {
  expect(isWorkspaceAllowed("SUPER_ADMIN", "super-admin")).toBe(true);
  expect(isWorkspaceAllowed("CLIENT_USER", "admin")).toBe(false);
});
