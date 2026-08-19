"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
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
  clientTaskStatusLabel,
  humanise,
  primaryAssigneeLabel,
  taskAccent,
  taskAccentClass,
  taskOpenHref,
  type CalendarAudience,
  type CalendarTask,
} from "@/components/operations/task-calendar/task-calendar-utils";

export function TaskCalendarEventCard({
  task,
  compact = false,
  selected = false,
  audience = "tenant",
  onSelect,
}: {
  task: CalendarTask;
  compact?: boolean;
  selected?: boolean;
  audience?: CalendarAudience;
  onSelect?: (task: CalendarTask) => void;
}) {
  const accent = taskAccent(task);
  const assignee = primaryAssigneeLabel(task);
  const highPriority = audience !== "client" && (task.priority === "high" || task.priority === "urgent");
  const statusLabel = audience === "client" ? clientTaskStatusLabel(task) : humanise(task.status);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [hoverOpen, setHoverOpen] = useState(false);

  const body = (
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
        {task.serviceName || task.clientName}
      </p>
      {compact && audience !== "client" ? null : (
        <p className={cn("truncate text-muted-foreground", compact ? "text-[10px]" : "text-[11px]")}>
          {audience === "client" ? (
            `${assignee} \u00b7 ${statusLabel}`
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                {assigneeInitials(assignee)}
              </span>
              {assignee}
            </span>
          )}
        </p>
      )}
    </div>
  );

  const className = cn(
    "relative w-full rounded-md border border-border/70 border-l-[3px] bg-background text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    taskAccentClass(accent),
    compact ? "px-1.5 py-1" : "px-2 py-1.5",
    selected && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
  );

  const hoverProps = {
    onMouseEnter: () => setHoverOpen(true),
    onMouseLeave: () => setHoverOpen(false),
    onFocus: () => setHoverOpen(true),
    onBlur: () => setHoverOpen(false),
  };

  const preview = (
      <TaskEventHoverPreview
      task={task}
      assignee={assignee}
      statusLabel={statusLabel}
      open={hoverOpen}
      anchorRef={triggerRef}
    />
  );

  if (onSelect) {
    return (
      <div ref={triggerRef} className="w-full" {...hoverProps}>
        <button
          type="button"
          className={className}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(task);
          }}
        >
          {body}
        </button>
        {preview}
      </div>
    );
  }

  return (
    <div ref={triggerRef} className="w-full" {...hoverProps}>
      <Link href={taskOpenHref(task)} className={cn(className, "block")}>
        {body}
      </Link>
      {preview}
    </div>
  );
}

function TaskEventHoverPreview({
  task,
  assignee,
  statusLabel,
  open,
  anchorRef,
}: {
  task: CalendarTask;
  assignee: string;
  statusLabel: string;
  open: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
}) {
  const previewId = useId();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const previewWidth = 240;
      const gap = 8;
      const viewportPadding = 12;
      const fitsRight = rect.right + gap + previewWidth <= window.innerWidth - viewportPadding;
      const left = fitsRight
        ? rect.right + gap
        : Math.max(viewportPadding, rect.left - previewWidth - gap);
      const top = Math.min(
        Math.max(viewportPadding, rect.top),
        window.innerHeight - viewportPadding - 180,
      );
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef, open]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      id={previewId}
      role="tooltip"
      className="pointer-events-none fixed z-50 w-60 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]"
      style={{ top: position.top, left: position.left }}
    >
      <p className="text-sm font-semibold">{task.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{task.serviceName || task.clientName}</p>
      <div className="my-2 h-px bg-border" />
      <dl className="flex flex-col gap-2 text-xs">
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
          <dd className="font-medium">{statusLabel}</dd>
        </div>
      </dl>
    </div>,
    document.body,
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
              {(task.serviceName || task.clientName)} · {format(task.dueDate, "h:mm a")}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
