import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { LoadingState } from "@/components/shared/loading-state";

test("exposes loading state to assistive technology", () => {
  render(<LoadingState label="Loading clients" />);
  expect(screen.getByLabelText("Loading clients")).toHaveAttribute(
    "aria-busy",
    "true",
  );
});
