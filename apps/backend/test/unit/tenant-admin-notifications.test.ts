import { describe, expect, it, vi } from "vitest";
import { RequestContext } from "../../src/auth/request-context";
import { TenantAdminNotificationsService } from "../../src/platform/tenant-admin-notifications.service";
import { TenantAdminNotificationsRepository } from "../../src/platform/tenant-admin-notifications.repository";

describe("TenantAdminNotificationsService", () => {
  it("rejects platform admin context before querying tenant notifications", async () => {
    const repository = {
      list: vi.fn(),
    } as unknown as TenantAdminNotificationsRepository;
    const service = new TenantAdminNotificationsService(repository);

    const platformContext: RequestContext = {
      userId: "user-1",
      authUserId: "auth-user-1",
      isPlatformAdmin: true,
      roles: ["SUPER_ADMIN"],
      permissions: [],
      requestId: "req-1",
    };

    await expect(service.list(platformContext, {})).rejects.toThrow(
      "Selected portal is not available for this membership.",
    );
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("returns tenant admin notifications list and unread count", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({
        unreadCount: 1,
        items: [
          {
            id: "notif-1",
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: "You have a new compliance task.",
            severity: "INFO",
            tenant_id: "tenant-1",
            action_url: "/admin/tasks",
            created_at: new Date("2026-08-05T10:00:00Z"),
            read_at: null,
          },
        ],
      }),
      unreadCount: vi.fn().mockResolvedValue(1),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
    } as unknown as TenantAdminNotificationsRepository;

    const service = new TenantAdminNotificationsService(repository);

    const tenantAdminContext: RequestContext = {
      userId: "user-2",
      authUserId: "auth-user-2",
      tenantId: "tenant-1",
      membershipId: "member-1",
      isPlatformAdmin: false,
      roles: ["TENANT_ADMIN"],
      permissions: ["tenant.read"],
      requestId: "req-2",
    };

    const listResult = await service.list(tenantAdminContext, { status: "ALL", limit: 20 });
    expect(listResult.unreadCount).toBe(1);
    expect(listResult.items[0].title).toBe("New Task Assigned");

    await service.markRead(tenantAdminContext, "notif-1");
    expect(repository.markRead).toHaveBeenCalledWith(tenantAdminContext, "notif-1");

    await service.markAllRead(tenantAdminContext);
    expect(repository.markAllRead).toHaveBeenCalledWith(tenantAdminContext);
  });
});
