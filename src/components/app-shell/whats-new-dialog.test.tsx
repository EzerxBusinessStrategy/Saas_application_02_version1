import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { WhatsNewDialog } from "@/components/app-shell/whats-new-dialog";
import { APP_VERSION } from "@/lib/app-version";

afterEach(() => {
  cleanup();
});

test("shows the latest release version, date, and notes", () => {
  render(<WhatsNewDialog open onOpenChange={() => undefined} />);

  expect(screen.getByRole("dialog", { name: "What's new" })).toBeInTheDocument();
  expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  expect(screen.getByText("Latest")).toBeInTheDocument();
  expect(screen.getByText("18 Aug 2026")).toBeInTheDocument();
  expect(screen.getByText("Initial platform release")).toBeInTheDocument();
  expect(screen.getByText("Added")).toBeInTheDocument();
  expect(screen.getByText("Improved")).toBeInTheDocument();
});
