import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FeatureBoundary } from "@/components/shared/feature-boundary";

test("allows a feature when one alternative permission matches", () => {
  render(
    <FeatureBoundary
      role="TENANT_ADMIN"
      permissions={["task.read.assigned", "task.read"]}
    >
      Tasks
    </FeatureBoundary>,
  );
  expect(screen.getByText("Tasks")).toBeInTheDocument();
});
