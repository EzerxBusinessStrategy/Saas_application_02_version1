import { expect, test } from "vitest";
import {
  clientRequestStatusTone,
  clientServiceTitles,
  employeeInitials,
  formatClientMoney,
  humanizeClientStatus,
  nextOpenClientTask,
} from "@/components/operations/client-portal-display";

test("hides a secondary service name when engagement and service titles match", () => {
  expect(clientServiceTitles("demo", "demo")).toEqual({ primary: "demo", secondary: null });
  expect(clientServiceTitles("GST Compliance", "GST Compliance")).toEqual({
    primary: "GST Compliance",
    secondary: null,
  });
  expect(clientServiceTitles("Acme FY 2026-27", "GST Compliance")).toEqual({
    primary: "GST Compliance",
    secondary: "Acme FY 2026-27",
  });
});

test("formats money without forced decimal zeros", () => {
  expect(formatClientMoney(0, "INR")).toBe("₹0");
  expect(formatClientMoney(1000, "INR")).toBe("₹1,000");
  expect(formatClientMoney(150000, "INR")).toBe("₹1,50,000");
});

test("maps request statuses to client-readable labels and tones", () => {
  expect(humanizeClientStatus("complete")).toBe("Completed");
  expect(humanizeClientStatus("in_progress")).toBe("In review");
  expect(humanizeClientStatus("active")).toBe("Active");
  expect(clientRequestStatusTone("complete")).toBe("success");
  expect(clientRequestStatusTone("pending")).toBe("warning");
  expect(clientRequestStatusTone("rejected")).toBe("danger");
});

test("picks the next open task from live task records", () => {
  const nextDue = "2026-08-20T00:00:00.000Z";
  const next = nextOpenClientTask(
    [
      { status: "completed", plannedDueAt: "2026-08-11T00:00:00.000Z", title: "GSTR-1" },
      { status: "in_progress", plannedDueAt: nextDue, title: "GSTR-3B" },
    ],
    nextDue,
  );
  expect(next?.title).toBe("GSTR-3B");
  expect(employeeInitials("Rahul Verma")).toBe("RV");
});
