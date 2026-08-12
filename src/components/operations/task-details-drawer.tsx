"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import type { OperationalTask, WorkLog } from "@/types/operations";

const statusLabel = {
  "to-do": "To do",
  "in-progress": "In progress",
  review: "Review",
  rejected: "Rejected",
  done: "Done",
} as const;

export function TaskDetailsDrawer({
  task,
  open,
  onOpenChange,
  workLogs,
  canUpdate,
  canChangeStatus = canUpdate,
  canManageAssignment = canUpdate,
  canTenantApprove = false,
  onTenantApproval,
  onUpdate,
}: {
  task: OperationalTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workLogs: WorkLog[];
  canUpdate: boolean;
  canChangeStatus?: boolean;
  canManageAssignment?: boolean;
  canTenantApprove?: boolean;
  onTenantApproval?: (
    task: OperationalTask,
    decision: "approve" | "return",
    remarks?: string,
  ) => Promise<boolean | void> | boolean | void;
  onUpdate: (task: OperationalTask) => void;
}) {
  const [showReturnComment, setShowReturnComment] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [returnCommentError, setReturnCommentError] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);

  useEffect(() => {
    setShowReturnComment(false);
    setReturnComment("");
    setReturnCommentError("");
    setIsDeciding(false);
  }, [open, task?.id]);

  if (!task) return null;
  const taskLogs = workLogs.filter((log) => log.taskId === task.id);
  const decideTenantApproval = async (decision: "approve" | "return") => {
    const remarks = returnComment.trim();
    if (decision === "return" && !remarks) {
      setReturnCommentError("Enter the changes required before returning this task.");
      return;
    }
    if (!onTenantApproval) return;
    setIsDeciding(true);
    try {
      const saved = await onTenantApproval(task, decision, remarks);
      if (saved === false) return;
      setShowReturnComment(false);
      setReturnComment("");
      setReturnCommentError("");
    } finally {
      setIsDeciding(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={task.title}
        description="Task context, work evidence, and review state."
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none"
      >
        <div className="pr-8">
          <p className="text-sm font-medium text-primary">{task.id}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {task.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {task.client} · {task.engagement} · {task.workGroup}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {task.description}
          </p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="mt-1 font-medium">{task.assignee}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Manager</dt>
              <dd className="mt-1 font-medium">{task.manager}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="mt-1 font-medium">{task.dueDate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SLA state</dt>
              <dd className="mt-1">
                <StatusBadge status={task.sla} />
              </dd>
            </div>
          </dl>
          <section className="mt-7">
            <h3 className="font-semibold">Status and review</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium">
                Task status
                <Select
                  className="mt-1"
                  value={task.status}
                  disabled={!canChangeStatus}
                  onChange={(event) =>
                    onUpdate({
                      ...task,
                      status: event.target.value as OperationalTask["status"],
                    })
                  }
                >
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <div>
                <p className="text-sm font-medium">Review</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {task.reviewStatus.replaceAll("-", " ")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Approval</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {task.approvalStatus.replaceAll("-", " ")}
                </p>
              </div>
            </div>
          </section>
          {task.reviewStatus === "changes-requested" && task.reviewComment ? (
            <section className="mt-6 border-l-4 border-warning bg-warning/10 px-4 py-3" aria-labelledby="changes-requested-heading">
              <h3 id="changes-requested-heading" className="font-semibold text-foreground">Changes requested</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{task.reviewComment}</p>
            </section>
          ) : null}
          <section className="mt-7 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Manager review</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {task.manager} reviews employee evidence for this work group.
                Work logs and recorded review remarks are included in delivery history below.
              </p>
              <p className="mt-3 text-sm font-medium">
                {task.reviewStatus === "approved"
                  ? "Manager review approved"
                  : task.reviewStatus === "pending"
                    ? "Awaiting manager review"
                    : task.reviewStatus.replaceAll("-", " ")}
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Tenant approval</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The Tenant Admin records the final delivery decision after manager approval.
              </p>
              {task.reviewStatus === "approved" && task.approvalStatus === "pending" ? (
                canTenantApprove && onTenantApproval ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={isDeciding} onClick={() => void decideTenantApproval("approve")}>
                        {isDeciding ? "Saving..." : "Approve delivery"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isDeciding}
                        onClick={() => {
                          setShowReturnComment(true);
                          setReturnCommentError("");
                        }}
                      >
                        Return for rework
                      </Button>
                    </div>
                    {showReturnComment ? (
                      <form
                        aria-label="Return task for rework"
                        className="mt-4 rounded-[var(--radius-control)] border border-border bg-muted/30 p-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void decideTenantApproval("return");
                        }}
                      >
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Changes required
                          <textarea
                            required
                            autoFocus
                            maxLength={2000}
                            className="min-h-24 rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="Explain what the employee must change before resubmitting."
                            value={returnComment}
                            aria-invalid={Boolean(returnCommentError)}
                            aria-describedby={returnCommentError ? "tenant-return-comment-error" : undefined}
                            onChange={(event) => {
                              setReturnComment(event.target.value);
                              if (event.target.value.trim()) setReturnCommentError("");
                            }}
                          />
                        </label>
                        {returnCommentError ? (
                          <p id="tenant-return-comment-error" className="mt-2 text-sm text-danger" role="alert">
                            {returnCommentError}
                          </p>
                        ) : null}
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isDeciding}
                            onClick={() => {
                              setShowReturnComment(false);
                              setReturnComment("");
                              setReturnCommentError("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={isDeciding}>
                            {isDeciding ? "Returning..." : "Confirm return"}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-medium">Awaiting tenant approval</p>
                )
              ) : (
                <p className="mt-3 text-sm font-medium">
                  {task.approvalStatus.replaceAll("-", " ")}
                </p>
              )}
            </div>
          </section>
          <section className="mt-7">
            <h3 className="font-semibold">Assignment and delivery controls</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Assignee
                <Select
                  className="mt-1"
                  value={task.assignee}
                  disabled={!canManageAssignment}
                  onChange={(event) =>
                    onUpdate({ ...task, assignee: event.target.value })
                  }
                >
                  {["Riley Shah", "Aarav Mehta", "Zoe Martin"].map(
                    (assignee) => (
                      <option key={assignee}>{assignee}</option>
                    ),
                  )}
                </Select>
              </label>
              <label className="text-sm font-medium">
                Due date
                <Input
                  className="mt-1"
                  type="date"
                  value={task.dueDate}
                  disabled={!canManageAssignment}
                  onChange={(event) =>
                    onUpdate({ ...task, dueDate: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Priority
                <Select
                  className="mt-1"
                  value={task.priority}
                  disabled={!canManageAssignment}
                  onChange={(event) =>
                    onUpdate({
                      ...task,
                      priority: event.target
                        .value as OperationalTask["priority"],
                    })
                  }
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </label>
              <label className="text-sm font-medium">
                Complexity
                <Select
                  className="mt-1"
                  value={task.complexity}
                  disabled={!canManageAssignment}
                  onChange={(event) =>
                    onUpdate({
                      ...task,
                      complexity: event.target
                        .value as OperationalTask["complexity"],
                    })
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="complex">Complex</option>
                  <option value="specialist">Specialist</option>
                </Select>
              </label>
            </div>
          </section>
          <section className="mt-7">
            <h3 className="font-semibold">Checklist</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {task.checklist.map((item, index) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3 text-sm"
                >
                  <input
                    aria-label={item.label}
                    type="checkbox"
                    checked={item.complete}
                    disabled={!canUpdate}
                    onChange={() =>
                      onUpdate({
                        ...task,
                        checklist: task.checklist.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, complete: !entry.complete }
                            : entry,
                        ),
                      })
                    }
                  />
                  <span
                    className={
                      item.complete
                        ? "text-muted-foreground line-through"
                        : "font-medium"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <FileText className="size-4" />
                Attachments
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {task.attachmentCount} authorised file
                {task.attachmentCount === 1 ? "" : "s"} linked to this task.
              </p>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <MessageSquare className="size-4" />
                Comments
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {task.commentCount} delivery comments are available to
                authorised users.
              </p>
            </div>
          </section>
          <section className="mt-7">
            <h3 className="font-semibold">Work logs and activity</h3>
            {taskLogs.length ? (
              <ul className="mt-3 flex flex-col divide-y">
                {taskLogs.map((log) => (
                  <li key={log.id} className="py-3 first:pt-0">
                    <p className="font-medium text-sm">
                      {log.employee} · {Math.floor(log.durationMinutes / 60)}h{" "}
                      {log.durationMinutes % 60}m
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {log.description}
                    </p>
                    {log.reviewerComment ? (
                      <p className="mt-1 text-sm text-warning">
                        Review: {log.reviewerComment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No work logs have been recorded yet.
              </p>
            )}
          </section>
          {task.dependencyIds.length ? (
            <p className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" />
              Depends on {task.dependencyIds.join(", ")}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
