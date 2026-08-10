import { describe, expect, it } from "vitest";
import { forbiddenPortal } from "../../src/auth/auth-errors";
import { RequestContext } from "../../src/auth/request-context";
import { requireEmployeeContext, requireEmployeeManagerContext } from "../../src/platform/employee-context";

const employeeContext: RequestContext = {
  userId: "user-1",
  authUserId: "auth-user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  isPlatformAdmin: false,
  roles: ["EMPLOYEE"],
  permissions: ["task.read.assigned"],
  requestId: "employee-context-test",
};

describe("employee portal role context", () => {
  it("allows an active employee membership into employee resources", () => {
    expect(requireEmployeeContext(employeeContext)).toMatchObject({
      tenantId: "tenant-1",
      membershipId: "membership-1",
      roles: ["EMPLOYEE"],
    });
  });

  it("requires both EMPLOYEE and MANAGER roles for manager capability", () => {
    expect(() => requireEmployeeManagerContext(employeeContext)).toThrow(forbiddenPortal().message);

    expect(
      requireEmployeeManagerContext({ ...employeeContext, roles: ["EMPLOYEE", "MANAGER"] }),
    ).toMatchObject({
      tenantId: "tenant-1",
      membershipId: "membership-1",
    });
  });

  it("rejects missing membership, platform-admin, and role-only contexts", () => {
    for (const context of [
      { ...employeeContext, membershipId: undefined },
      { ...employeeContext, isPlatformAdmin: true, roles: ["SUPER_ADMIN", "EMPLOYEE"] },
      { ...employeeContext, roles: ["MANAGER"] },
    ]) {
      expect(() => requireEmployeeContext(context)).toThrow(forbiddenPortal().message);
      expect(() => requireEmployeeManagerContext(context)).toThrow(forbiddenPortal().message);
    }
  });
});
