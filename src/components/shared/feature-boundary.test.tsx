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

test("allows tenant admin to open tenant activity", () => {
  render(
    <FeatureBoundary role="TENANT_ADMIN" permissions={["engagement.manage"]}>
      Activity
    </FeatureBoundary>,
  );
  expect(screen.getByText("Activity")).toBeInTheDocument();
});

test("denies finance users from tenant activity", () => {
  render(
    <FeatureBoundary role="FINANCE_USER" permissions={["engagement.manage"]}>
      Activity
    </FeatureBoundary>,
  );
  expect(screen.getByText("You don't have access to this area")).toBeInTheDocument();
});
