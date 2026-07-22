import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  chartTooltipCursor,
  ChartTooltipContent,
} from "@/components/dashboard/chart-tooltip";

test("uses semantic application tokens for readable chart tooltip content", () => {
  render(
    <ChartTooltipContent
      active
      label="Northstar Labs"
      payload={[{ name: "Active users", value: 184, color: "var(--primary)" }]}
    />,
  );

  expect(screen.getByTestId("chart-tooltip")).toHaveClass(
    "bg-popover",
    "text-popover-foreground",
    "border-border",
  );
  expect(screen.getByText("Northstar Labs")).toBeInTheDocument();
  expect(screen.getByText("184")).toBeInTheDocument();
  expect(chartTooltipCursor).toBe(false);
});
