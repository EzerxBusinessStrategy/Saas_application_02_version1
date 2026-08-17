import { describe, expect, test } from "vitest";
import { isAppWorkspace, normalizeAppWorkspace } from "@/lib/workspace-routing";

describe("workspace-routing", () => {
  test("accepts supported app workspaces", () => {
    expect(isAppWorkspace("admin")).toBe(true);
    expect(isAppWorkspace("super-admin")).toBe(true);
  });

  test("rejects reserved and unknown paths", () => {
    expect(isAppWorkspace("login")).toBe(false);
    expect(normalizeAppWorkspace("login")).toBeNull();
    expect(normalizeAppWorkspace("forgot-password")).toBeNull();
  });

  test("maps manager aliases to employee", () => {
    expect(normalizeAppWorkspace("manager")).toBe("employee");
  });
});
