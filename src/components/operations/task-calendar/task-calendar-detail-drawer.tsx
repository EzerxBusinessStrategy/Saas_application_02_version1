"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  assigneeInitials,
  humanise,
  taskAccent,
  type CalendarAudience,
  type CalendarTask,
} from "@/components/operations/task-calendar/task-calendar-utils";

export function TaskCalendarDetailDrawer({
  task,
  open,
  onOpenChange,
  audience = "tenant",
}: {
  task: CalendarTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience?: CalendarAudience;
}) {
  if (!task) return null;

  const accent = taskAccent(task);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={task.title}
        description="Scheduled task details"
        className="left-auto right-0 top-0 h-full max-h-none w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l p-0"
      >
        <div className="flex h-full flex-col px-6 py-6 pr-12">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{task.title}</h2>
            <p className="text-sm text-muted-foreground">{task.clientName}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={accent === "info" ? "info" : accent === "success" ? "success" : accent === "warning" ? "warning" : accent === "danger" ? "danger" : "neutral"}>
              {humanise(task.status)}
            </Badge>
            {audience === "client" ? null : (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  task.priority === "high" || task.priority === "urgent"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {humanise(task.priority)}
              </span>
            )}
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <DrawerField label="Due" value={`${format(task.dueDate, "d MMM yyyy")} · ${format(task.dueDate, "h:mm a")}`} />
            <DrawerField label="Service" value={task.serviceName} />
            {audience === "client" ? null : (
              <DrawerField label="Work group" value={task.workGroupName ?? "Direct assignment"} />
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned to</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {task.assignees.length ? (
                  task.assignees.map((assignee) => (
                    <span
                      key={assignee.id}
                      className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-sm"
                    >
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {assigneeInitials(assignee.name)}
                      </span>
                      {assignee.name}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">No active assignees</span>
                )}
              </dd>
            </div>
          </dl>

          {task.description ? (
            <p className="mt-4 text-sm text-muted-foreground">{task.description}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DrawerField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
