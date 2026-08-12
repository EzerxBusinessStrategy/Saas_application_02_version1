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
        reviewStatus: "pending",
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
    "",
  );
});

test("requires and submits Tenant Admin rework comments", () => {
  const onTenantApproval = vi.fn();
  render(
    <TaskDetailsDrawer
      task={{
        ...operationalTasks[0],
        status: "review",
        reviewStatus: "pending",
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

  fireEvent.click(screen.getByRole("button", { name: "Return for rework" }));
  const comment = screen.getByLabelText("Changes required");
  expect(comment).toBeRequired();
  fireEvent.change(comment, {
    target: { value: "Correct the GST amount and attach the revised worksheet." },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Return task for rework" }));

  expect(onTenantApproval).toHaveBeenCalledWith(
    expect.objectContaining({ id: operationalTasks[0].id }),
    "return",
    "Correct the GST amount and attach the revised worksheet.",
  );
});

test("shows requested changes to the employee in task details", () => {
  render(
    <TaskDetailsDrawer
      task={{
        ...operationalTasks[0],
        status: "in-progress",
        reviewStatus: "changes-requested",
        approvalStatus: "rejected",
        reviewComment: "Correct the GST amount and attach the revised worksheet.",
      }}
      open
      onOpenChange={vi.fn()}
      workLogs={workLogs}
      canUpdate={false}
      onUpdate={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "Changes requested" })).toBeInTheDocument();
  expect(screen.getByText("Correct the GST amount and attach the revised worksheet.")).toBeInTheDocument();
});
