import { describe, expect, it } from "vitest";
import {
  isTenantAdminNotificationType,
  isTaskWorkflowTenantAdminDeliveryType,
  tenantAdminNotificationTypeList,
} from "../../src/platform/tenant-admin-notification-policy";

describe("tenant admin notification policy", () => {
  it("includes task review submission notifications in the tenant admin allowlist", () => {
    expect(tenantAdminNotificationTypeList).toContain("TASK_SUBMITTED_FOR_TENANT_REVIEW");
    expect(tenantAdminNotificationTypeList).toContain("TASK_REVIEW_CLOSED_BY_MANAGER");
    expect(isTenantAdminNotificationType("TASK_SUBMITTED_FOR_TENANT_REVIEW")).toBe(true);
    expect(isTenantAdminNotificationType("TASK_SUBMITTED_FOR_MANAGER_REVIEW")).toBe(false);
  });

  it("routes only task-workflow tenant delivery types to the tenant-admin socket namespace", () => {
    expect(isTaskWorkflowTenantAdminDeliveryType("TASK_SUBMITTED_FOR_TENANT_REVIEW")).toBe(true);
    expect(isTaskWorkflowTenantAdminDeliveryType("TASK_ASSIGNED")).toBe(false);
  });
});
