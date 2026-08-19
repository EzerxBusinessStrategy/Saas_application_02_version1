import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ClientTaskFeedbackPrompt } from "@/components/operations/client-task-feedback-prompt";
import { CLIENT_FEEDBACK_PROMPT_SNOOZE_MS } from "@/lib/client-feedback-prompt";

const pendingItem = {
  taskId: "task-1",
  taskTitle: "tax",
  invoiceId: "invoice-1",
  invoiceNumber: "Invoice 1",
  employeeId: "employee-1",
  employeeName: "Demo",
  invoiceSentAt: "2026-08-18T10:00:00.000Z",
  completedAt: "2026-08-18T10:00:00.000Z",
  expiresAt: "2026-10-17T10:00:00.000Z",
};

vi.mock("@/features/client-portal/api/task-feedback-api", () => ({
  listPendingTaskFeedback: vi.fn(async () => ({ items: [pendingItem] })),
  submitTaskFeedback: vi.fn(async () => undefined),
}));

test("does not reopen the prompt within 72 hours after Later", async () => {
  window.localStorage.clear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ClientTaskFeedbackPrompt />
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("button", { name: "Later" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Later" })).not.toBeInTheDocument());

  view.unmount();
  const again = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={again}>
      <ClientTaskFeedbackPrompt />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.queryByRole("button", { name: "Later" })).not.toBeInTheDocument());
  expect(Date.parse(JSON.parse(window.localStorage.getItem("saas-app:client-feedback-prompt") ?? "{}").snoozeUntil)).toBeGreaterThan(
    Date.now() + CLIENT_FEEDBACK_PROMPT_SNOOZE_MS - 5_000,
  );
});
