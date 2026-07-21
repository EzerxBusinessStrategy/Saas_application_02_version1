"use client";

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
  done: "Done",
} as const;

export function TaskDetailsDrawer({
  task,
  open,
  onOpenChange,
  workLogs,
  canUpdate,
  onUpdate,
}: {
  task: OperationalTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workLogs: WorkLog[];
  canUpdate: boolean;
  onUpdate: (task: OperationalTask) => void;
}) {
  if (!task) return null;
  const taskLogs = workLogs.filter((log) => log.taskId === task.id);
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
                  disabled={!canUpdate}
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
            {canUpdate && task.reviewStatus === "pending" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    onUpdate({ ...task, reviewStatus: "approved" })
                  }
                >
                  Approve review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onUpdate({ ...task, reviewStatus: "changes-requested" })
                  }
                >
                  Request changes
                </Button>
              </div>
            ) : null}
          </section>
          <section className="mt-7">
            <h3 className="font-semibold">Assignment and delivery controls</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Assignee
                <Select
                  className="mt-1"
                  value={task.assignee}
                  disabled={!canUpdate}
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
                  disabled={!canUpdate}
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
                  disabled={!canUpdate}
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
                  disabled={!canUpdate}
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
