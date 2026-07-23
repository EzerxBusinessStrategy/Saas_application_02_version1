import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StatusBadge } from "@/components/shared/status-badge";
it("renders a textual status", () => {
  render(<StatusBadge status="at-risk" />);
  expect(screen.getByText("at risk")).toBeInTheDocument();
});

it("renders workforce status labels", () => {
  render(<StatusBadge status="partially-available" />);
  expect(screen.getByText("partially available")).toBeInTheDocument();
});

it("uses stable pill geometry for every status variant", () => {
  const statuses = [
    "on-track",
    "at-risk",
    "blocked",
    "complete",
    "pending",
    "available",
    "partially-available",
    "unavailable",
    "active",
    "on-leave",
    "inactive",
    "balanced",
    "overloaded",
    "suspended",
    "onboarding",
    "paused",
    "archived",
    "healthy",
    "watch",
    "planning",
    "on-hold",
  ] as const;
  const { container } = render(
    <div>{statuses.map((status) => <StatusBadge key={status} status={status} />)}</div>,
  );

  for (const pill of container.querySelectorAll("span")) {
    expect(pill).toHaveClass(
      "min-h-5",
      "shrink-0",
      "whitespace-nowrap",
      "rounded-full",
    );
  }
});
