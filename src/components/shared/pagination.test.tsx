import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Pagination } from "@/components/shared/pagination";

test("provides accessible previous, next, page, and page-size controls", () => {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <Pagination
      page={2}
      pageCount={4}
      totalItems={18}
      pageSize={5}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(onPageChange).toHaveBeenCalledWith(3);
  expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.change(screen.getByLabelText("Rows per page"), {
    target: { value: "10" },
  });
  expect(onPageSizeChange).toHaveBeenCalledWith(10);
});
