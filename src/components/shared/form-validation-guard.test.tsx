import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FormValidationGuard } from "@/components/shared/form-validation-guard";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { error: toastError },
}));

afterEach(() => toastError.mockClear());

test("blocks a blank required field and names it in the feedback", async () => {
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
  render(
    <>
      <FormValidationGuard />
      <form noValidate onSubmit={onSubmit}>
        <label>
          Client name
          <input required data-field-label="Client name" />
        </label>
        <button type="submit">Create client</button>
      </form>
    </>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Create client" }));

  const input = screen.getByLabelText("Client name");
  expect(onSubmit).not.toHaveBeenCalled();
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(toastError).toHaveBeenCalledWith("Enter Client name.");
});

test("clears the temporary validation state once the field is edited", () => {
  render(
    <>
      <FormValidationGuard />
      <form noValidate>
        <label>
          Work email
          <input required data-field-label="Work email" />
        </label>
        <button type="submit">Continue</button>
      </form>
    </>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const input = screen.getByLabelText("Work email") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "admin@example.com" } });

  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input.validationMessage).toBe("");
});
