import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ErrorState } from "@/components/shared/error-state";

test("exposes a labelled retry action", () => {
  const onRetry = vi.fn();
  render(<ErrorState onRetry={onRetry} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledOnce();
});
