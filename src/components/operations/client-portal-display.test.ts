import { expect, test } from "vitest";
import {
  clientRequestStatusTone,
  clientServiceTitles,
  clientTaskListStatus,
  employeeInitials,
  formatClientMoney,
  formatClientMoneyCompact,
  humanizeClientStatus,
  isClientTaskDueSoon,
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

test("compacts large Indian amounts for portfolio cards", () => {
  expect(formatClientMoneyCompact(0, "INR")).toEqual({ display: "₹0", exact: "₹0" });
  expect(formatClientMoneyCompact(1000, "INR")).toEqual({ display: "₹1K", exact: "₹1,000" });
  expect(formatClientMoneyCompact(5600, "INR")).toEqual({ display: "₹5.6K", exact: "₹5,600" });
  expect(formatClientMoneyCompact(840_000, "INR")).toEqual({ display: "₹8.4L", exact: "₹8,40,000" });
});

test("labels task list statuses for the client drawer", () => {
  expect(clientTaskListStatus("assigned")).toBe("Scheduled");
  expect(clientTaskListStatus("in_progress")).toBe("Open");
  expect(clientTaskListStatus("completed")).toBe("Completed");
});

test("treats upcoming open tasks within 7 days as due soon", () => {
  const now = new Date(2026, 7, 19);
  expect(isClientTaskDueSoon("2026-08-20T00:00:00.000Z", "assigned", now)).toBe(true);
  expect(isClientTaskDueSoon("2026-09-28T00:00:00.000Z", "assigned", now)).toBe(false);
  expect(isClientTaskDueSoon("2026-08-20T00:00:00.000Z", "completed", now)).toBe(false);
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
