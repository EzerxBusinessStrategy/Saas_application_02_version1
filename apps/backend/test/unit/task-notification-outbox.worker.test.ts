import { describe, expect, it, vi } from "vitest";
import { TaskNotificationOutboxWorker } from "../../src/platform/task-notification-outbox.worker";

const event = {
  event_id: "event-1",
  tenant_id: "tenant-1",
  notification_id: "notification-1",
};

function createWorker(query: ReturnType<typeof vi.fn>) {
  const gateway = { emitNewNotification: vi.fn(() => 1) };
  const worker = new TaskNotificationOutboxWorker({ query } as never, gateway as never);
  return { worker, gateway };
}

describe("task notification outbox worker", () => {
  it("claims a bounded batch, emits each persisted recipient, then completes the event", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("claim_task_notification_outbox")) return { rows: [event] };
      if (sql.includes("get_task_notification_outbox_recipients")) {
        return {
          rows: [
            {
              recipient_user_id: "user-1",
              notification_id: "notification-1",
              notification_type: "TASK_ASSIGNED",
              title: "New task",
              message: "A task was assigned.",
              severity: "INFO",
              tenant_id: "tenant-1",
              action_url: "/employee/tasks?task=task-1",
              created_at: new Date(),
              read_at: null,
            },
            {
              recipient_user_id: "user-2",
              notification_id: "notification-1",
              notification_type: "TASK_ASSIGNED",
              title: "New task",
              message: "A task was assigned.",
              severity: "INFO",
              tenant_id: "tenant-1",
              action_url: null,
              created_at: new Date(),
              read_at: null,
            },
          ],
        };
      }
      if (sql.includes("complete_task_notification_outbox")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const { worker, gateway } = createWorker(query);

    await (worker as unknown as { flush(): Promise<void> }).flush();

    expect(query.mock.calls[0]).toEqual(["select * from private.claim_task_notification_outbox($1)", [50]]);
    expect(gateway.emitNewNotification).toHaveBeenCalledTimes(2);
    expect(gateway.emitNewNotification).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "tenant-1",
      expect.objectContaining({ id: "notification-1", actionUrl: "/employee/tasks?task=task-1", readAt: null }),
    );
    expect(query.mock.calls.some(([sql]) => String(sql).includes("complete_task_notification_outbox"))).toBe(true);
  });

  it("returns the claimed event to the retry queue when recipient delivery fails", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("get_task_notification_outbox_recipients")) throw new Error("database unavailable");
      if (sql.includes("retry_task_notification_outbox")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const { worker, gateway } = createWorker(query);

    await expect((worker as unknown as { deliver(value: typeof event): Promise<unknown> }).deliver(event)).resolves.toEqual({
      recipients: 0,
      connectedSockets: 0,
    });

    expect(gateway.emitNewNotification).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).includes("retry_task_notification_outbox"))).toBe(true);
  });
});
