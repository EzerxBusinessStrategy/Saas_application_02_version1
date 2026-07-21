import { expect, test } from "vitest";
import {
  getOperationalWorkspace,
  isGamificationVisible,
  listOperationalTasks,
  progressPercent,
  validateWorkLog,
} from "@/features/operations/api/operations-api";

test("limits manager, employee, and client task results to their assigned scope", async () => {
  await expect(listOperationalTasks("manager")).resolves.toHaveLength(3);
  await expect(listOperationalTasks("employee")).resolves.toHaveLength(2);
  await expect(listOperationalTasks("client")).resolves.toHaveLength(2);
});

test("validates a work log and excludes internal client data", async () => {
  await expect(
    validateWorkLog({
      taskId: "TASK-1042",
      date: "2026-07-21",
      durationMinutes: 60,
      description: "Reviewed source documents.",
    }),
  ).resolves.toMatchObject({ taskId: "TASK-1042" });
  const client = await getOperationalWorkspace("client");
  expect(
    client.documents.every((document) => document.visibility === "client"),
  ).toBe(true);
  expect(
    client.invoices.every((invoice) => invoice.client === "Northstar Labs"),
  ).toBe(true);
});

test("filters task results and handles optional professional progress safely", async () => {
  await expect(
    listOperationalTasks("admin", { priority: "high" }),
  ).resolves.toHaveLength(2);
  expect(progressPercent(0, 4)).toBe(0);
  expect(progressPercent(4, 4)).toBe(100);
  expect(isGamificationVisible({ enabled: false, reducedMotion: true })).toBe(
    false,
  );
  expect(isGamificationVisible({ enabled: true, reducedMotion: true })).toBe(
    true,
  );
});
