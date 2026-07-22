import { render, screen } from "@testing-library/react";
import { ShieldCheck } from "lucide-react";
import { expect, test } from "vitest";
import { PageHeader } from "@/components/shared/page-header";

test("renders dashboard context", () => {
  render(
    <PageHeader
      eyebrow="Platform"
      title="Platform overview"
      description="Tenant health across the platform"
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Platform overview" }),
  ).toBeInTheDocument();
});

test("renders an accessible role context marker", () => {
  render(
    <PageHeader
      eyebrow="Super Admin"
      eyebrowIcon={ShieldCheck}
      title="Platform overview"
    />,
  );
  expect(
    screen.getByLabelText("Page context: Super Admin"),
  ).toBeInTheDocument();
});
