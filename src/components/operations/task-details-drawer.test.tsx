import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { operationalTasks, workLogs } from "@/mocks/operations";

test("supports keyboard-accessible task status and checklist changes", () => {
  const onUpdate = vi.fn();
  render(
    <TaskDetailsDrawer
      task={operationalTasks[0]}
      open
      onOpenChange={vi.fn()}
      workLogs={workLogs}
      canUpdate
      onUpdate={onUpdate}
    />,
  );
  fireEvent.change(screen.getByLabelText("Task status"), {
    target: { value: "review" },
  });
  expect(onUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "review" }),
  );
  fireEvent.click(screen.getByLabelText("Review source documents"));
  expect(onUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ checklist: expect.any(Array) }),
  );
});

test("shows tenant approval actions only to an authorised tenant reviewer", () => {
  const onTenantApproval = vi.fn();
  render(
    <TaskDetailsDrawer
      task={{
        ...operationalTasks[0],
        status: "review",
        reviewStatus: "approved",
        approvalStatus: "pending",
      }}
      open
      onOpenChange={vi.fn()}
      workLogs={workLogs}
      canUpdate
      canTenantApprove
      onTenantApproval={onTenantApproval}
      onUpdate={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Approve delivery" }));
  expect(onTenantApproval).toHaveBeenCalledWith(
    expect.objectContaining({ id: operationalTasks[0].id }),
    "approve",
  );
});
