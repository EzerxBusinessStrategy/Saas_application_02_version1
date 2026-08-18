"use client";

import { format } from "date-fns";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  assigneeInitials,
  humanise,
  primaryAssigneeLabel,
  taskAccent,
  taskAccentClass,
  taskOpenHref,
  type CalendarTask,
} from "@/components/operations/task-calendar/task-calendar-utils";

export function TaskCalendarEventCard({
  task,
  compact = false,
  selected = false,
  onSelect,
}: {
  task: CalendarTask;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (task: CalendarTask) => void;
}) {
  const accent = taskAccent(task);
  const assignee = primaryAssigneeLabel(task);
  const highPriority = task.priority === "high" || task.priority === "urgent";

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <p className={cn("truncate font-medium text-foreground", compact ? "text-[11px]" : "text-xs")}>
            {task.title}
          </p>
          {highPriority ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
              !
            </span>
          ) : null}
        </div>
        <p className={cn("truncate text-muted-foreground", compact ? "text-[10px]" : "text-[11px]")}>
          {task.clientName}
        </p>
        <p className={cn("truncate text-muted-foreground", compact ? "text-[10px]" : "text-[11px]")}>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
              {assigneeInitials(assignee)}
            </span>
            {assignee}
          </span>
        </p>
      </div>

      <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden w-56 rounded-md border bg-popover p-3 text-popover-foreground shadow-md group-hover/event:block">
        <p className="text-sm font-semibold">{task.title}</p>
        <div className="my-2 h-px bg-border" />
        <p className="text-xs text-muted-foreground">{task.clientName}</p>
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd className="font-medium">{format(task.dueDate, "d MMM, h:mm a")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assigned</dt>
            <dd className="font-medium">{assignee}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{humanise(task.status)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs font-medium text-primary">Open task →</p>
      </div>
    </>
  );

  const className = cn(
    "group/event relative w-full rounded-md border border-border/70 border-l-[3px] bg-background text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    taskAccentClass(accent),
    compact ? "px-1.5 py-1" : "px-2 py-1.5",
    selected && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
  );

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={() => onSelect(task)}>
        {body}
      </button>
    );
  }

  return (
    <Link href={taskOpenHref(task)} className={cn(className, "block")}>
      {body}
    </Link>
  );
}

export function TaskCalendarOverflowList({
  tasks,
  onSelectTask,
}: {
  tasks: readonly CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="px-1 text-left text-[11px] font-medium text-primary hover:underline"
        >
          +{tasks.length} more
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
        {tasks.map((task) => (
          <DropdownMenuItem key={task.id} onSelect={() => onSelectTask(task)} className="flex flex-col items-start gap-0.5">
            <span className="font-medium">{task.title}</span>
            <span className="text-xs text-muted-foreground">
              {task.clientName} · {format(task.dueDate, "h:mm a")}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
