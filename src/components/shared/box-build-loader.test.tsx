import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BoxBuildLoader } from "@/components/shared/box-build-loader";

test("renders an accessible shared loader with the complete box sequence", () => {
  const { container } = render(<BoxBuildLoader label="Loading tenant dashboard" />);

  expect(screen.getByRole("status", { name: "Loading tenant dashboard" })).toHaveAttribute("aria-busy", "true");
  expect(container.querySelectorAll(".box-build-loader__box")).toHaveLength(8);
  expect(container.querySelector(".box-build-loader__ground")).toBeInTheDocument();
});
