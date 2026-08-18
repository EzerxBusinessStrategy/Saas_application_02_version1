import { describe, expect, it } from "vitest";
import {
  activityTitle,
  buildActivityFeed,
  compactPeriodLabel,
  compactRelativeTime,
  visibleActivityCount,
  type DashboardActivityEvent,
} from "@/components/tenant-administration/dashboard-activity";

function event(overrides: Partial<DashboardActivityEvent>): DashboardActivityEvent {
  return {
    id: overrides.id ?? "1",
    action: overrides.action ?? "SERVICE_CREATED",
    label: overrides.label ?? "service created",
    resourceType: overrides.resourceType ?? "service",
    actor: overrides.actor ?? "Sayantan",
    createdAt: overrides.createdAt ?? "2026-08-18T10:00:00.000Z",
  };
}

describe("dashboard activity feed", () => {
  it("puts the action first with compact titles", () => {
    expect(activityTitle("SERVICE_CREATED")).toBe("Service created");
    expect(activityTitle("TENANT_ADMIN_LOGGED_IN")).toBe("Tenant logged in");
    expect(activityTitle("CLIENT_USER_LOGGED_OUT")).toBe("Client logged out");
  });

  it("uses compact relative timestamps", () => {
    const now = Date.parse("2026-08-18T12:00:00.000Z");
    expect(compactRelativeTime("2026-08-18T08:00:00.000Z", now)).toBe("4h ago");
    expect(compactRelativeTime("2026-08-17T15:00:00.000Z", now)).toBe("21h ago");
  });

  it("collapses consecutive authentication events for the same actor", () => {
    const feed = buildActivityFeed(
      [
        event({ id: "a", action: "SERVICE_CREATED", resourceType: "service", createdAt: "2026-08-18T11:00:00.000Z" }),
        event({ id: "b", action: "TENANT_ADMIN_LOGGED_IN", resourceType: "session", createdAt: "2026-08-18T10:00:00.000Z" }),
        event({ id: "c", action: "TENANT_ADMIN_LOGGED_OUT", resourceType: "session", createdAt: "2026-08-18T09:00:00.000Z" }),
        event({ id: "d", action: "CLIENT_USER_LOGGED_IN", resourceType: "session", createdAt: "2026-08-18T08:00:00.000Z" }),
      ],
      "all",
    );

    expect(feed.rows).toHaveLength(2);
    expect(feed.rows[0]).toMatchObject({ kind: "event", title: "Service created" });
    expect(feed.rows[1]).toMatchObject({
      kind: "auth-group",
      actor: "Sayantan",
      eventCount: 3,
    });
  });

  it("keeps only six visible rows and reports the remainder", () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event({
        id: String(index),
        action: "TASK_CREATED",
        resourceType: "task",
        createdAt: `2026-08-18T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const feed = buildActivityFeed(events, "tasks");
    expect(feed.rows).toHaveLength(visibleActivityCount);
    expect(feed.hiddenCount).toBe(4);
  });

  it("can return every collapsed row for the full activity page", () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event({
        id: String(index),
        action: "TASK_CREATED",
        resourceType: "task",
        createdAt: `2026-08-18T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const feed = buildActivityFeed(events, "all", Number.POSITIVE_INFINITY);
    expect(feed.rows).toHaveLength(10);
    expect(feed.hiddenCount).toBe(0);
  });

  it("filters authentication events separately from system changes", () => {
    const events = [
      event({ id: "a", action: "SERVICE_CREATED", resourceType: "service" }),
      event({ id: "b", action: "TENANT_ADMIN_LOGGED_IN", resourceType: "session" }),
    ];
    expect(buildActivityFeed(events, "auth").rows).toHaveLength(1);
    expect(buildActivityFeed(events, "changes").rows).toHaveLength(1);
    expect(buildActivityFeed(events, "changes").rows[0]).toMatchObject({ title: "Service created" });
  });

  it("formats a compact period range", () => {
    expect(compactPeriodLabel("2026-04-01", "2027-01-20")).toBe("Apr 1, 2026 – Jan 20, 2027");
  });
});
