import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FilterToolbar } from "@/components/shared/filter-toolbar";

test("clears active filters without owning feature-specific filter state", () => {
  const onClear = vi.fn();
  render(
    <FilterToolbar
      search={{
        value: "Taylor",
        onChange: vi.fn(),
        label: "Search people",
        placeholder: "Search",
      }}
      activeFilterCount={2}
      onClear={onClear}
    >
      <label>
        Department
        <select>
          <option>All</option>
        </select>
      </label>
    </FilterToolbar>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(onClear).toHaveBeenCalledOnce();
});
