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
