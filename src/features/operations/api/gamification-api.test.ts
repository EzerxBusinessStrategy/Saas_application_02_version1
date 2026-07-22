import { expect, test } from "vitest";
import {
  createRecognition,
  getGamificationWorkspace,
  getWorkLogConsistency,
} from "@/features/operations/api/operations-api";

test("excludes leave, holidays, and non-working days from work-log completion", () => {
  const consistency = getWorkLogConsistency();

  expect(consistency.scheduledDays).toBe(3);
  expect(consistency.approvedLeaveDays).toBe(1);
  expect(consistency.holidayDays).toBe(1);
  expect(consistency.missingDays).toBe(1);
});

test("keeps client onboarding and deliverables limited to client-visible data", async () => {
  const client = await getGamificationWorkspace("client");

  expect(client.onboarding.every((step) => step.clientVisible)).toBe(true);
  expect(
    client.deliverables.every((item) => item.clientId === "northstar"),
  ).toBe(true);
  expect(client.recognitions).toEqual([]);
});

test("prevents a duplicate recognition in the current mock session", async () => {
  const input = {
    recipient: "Riley Shah",
    recipientType: "employee" as const,
    category: "quality-work" as const,
    message: "Clear evidence links improved the GST Filing handoff.",
    relatedWork: "GST Filing",
    privateNote: "",
    visibility: "manager-recipient" as const,
    notifyRecipient: true,
  };

  expect((await createRecognition(input)).duplicate).toBe(false);
  expect((await createRecognition(input)).duplicate).toBe(true);
});
