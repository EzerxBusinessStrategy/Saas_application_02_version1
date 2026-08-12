import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FormDraftPersistence } from "@/components/shared/form-draft-persistence";
import { writeFormDraft } from "@/lib/client/form-draft-store";

afterEach(() => window.localStorage.clear());

test("restores an unfinished form without restoring password fields", async () => {
  writeFormDraft("/:employee-create", [
    { key: "field:name", value: "Asha Patel" },
    { key: "field:password", value: "not-stored" },
  ]);

  render(
    <>
      <FormDraftPersistence />
      <form data-draft-key="employee-create">
        <input aria-label="Name" name="name" defaultValue="" />
        <input aria-label="Password" name="password" type="password" defaultValue="" />
      </form>
    </>,
  );

  await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Asha Patel"));
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

test("clears a draft when a valid form is submitted", async () => {
  writeFormDraft("/:employee-create", [{ key: "field:name", value: "Asha Patel" }]);
  render(
    <>
      <FormDraftPersistence />
      <form data-draft-key="employee-create">
        <input aria-label="Name" name="name" defaultValue="" />
        <button type="submit">Save</button>
      </form>
    </>,
  );

  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => expect(window.localStorage.getItem("saas-form-draft:v1:/:employee-create")).toBeNull());
});
