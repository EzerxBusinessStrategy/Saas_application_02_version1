import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";

test("keeps entity identity and metadata accessible in the mobile table alternative", () => {
  render(
    <MobileEntityCard
      title="A very long employee name used to verify truncation behavior"
      identifier="EMP-001"
      metadata={
        <div>
          <dt>Department</dt>
          <dd>Taxation</dd>
        </div>
      }
    />,
  );
  expect(
    screen.getByRole("heading", { name: /very long employee/i }),
  ).toHaveAttribute("title");
  expect(screen.getByText("Taxation")).toBeInTheDocument();
});
