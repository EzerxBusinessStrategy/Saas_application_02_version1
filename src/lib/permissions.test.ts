import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";
import { isAccessibleBrandColour } from "@/lib/tenant-theme";
describe("permissions and tenant themes", () => {
  it("does not grant employee billing access", () =>
    expect(hasPermission("EMPLOYEE", "invoice.create")).toBe(false));
  it("grants a manager assigned-task access", () =>
    expect(hasPermission("MANAGER", "task.read.assigned")).toBe(true));
  it("accepts a six-digit tenant colour", () =>
    expect(isAccessibleBrandColour("#2563eb")).toBe(true));
  it("rejects malformed tenant colours", () =>
    expect(isAccessibleBrandColour("blue")).toBe(false));
});
