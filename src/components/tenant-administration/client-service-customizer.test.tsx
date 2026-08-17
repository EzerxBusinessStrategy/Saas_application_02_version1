import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ClientServiceCustomizer, type ClientServiceDraftTask } from "@/components/tenant-administration/client-service-customizer";

const tasks: ClientServiceDraftTask[] = [
  {
    taskType: "demo",
    title: "demo",
    frequency: "monthly",
    dueRule: { type: "fixed_day_of_month", day: 11 },
    unitType: "per_task",
    rateAmount: 150_000,
    taxCode: "",
    enabled: true,
  },
  {
    taskType: "GST",
    title: "GST",
    frequency: "monthly",
    dueRule: { type: "fixed_day_of_month", day: 11 },
    unitType: "per_task",
    rateAmount: 10_000,
    taxCode: "",
    enabled: true,
  },
];

test("shows full task names, frequencies, due days, and prices", () => {
  render(
    <ClientServiceCustomizer
      serviceName="demo"
      currencyCode="INR"
      tasks={tasks}
      onChange={() => undefined}
    />,
  );

  expect(screen.getByDisplayValue("demo")).toBeInTheDocument();
  expect(screen.getByDisplayValue("GST")).toBeInTheDocument();
  expect(screen.getByLabelText("Frequency for demo")).toHaveValue("monthly");
  expect(screen.getByLabelText("Frequency for GST")).toHaveValue("monthly");
  expect(screen.getAllByText("Due day of month")).toHaveLength(2);
  expect(screen.getAllByDisplayValue("11")).toHaveLength(2);
  expect(screen.getByDisplayValue("150000")).toBeInTheDocument();
  expect(screen.getByDisplayValue("10000")).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { name: /Include/ })).toHaveLength(2);
});
