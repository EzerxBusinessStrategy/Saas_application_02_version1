"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CircleAlert, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type { OperationalTask } from "@/types/operations";

const columns: Array<{ value: OperationalTask["status"]; label: string }> = [
  { value: "to-do", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "rejected", label: "Returned" },
  { value: "done", label: "Done" },
];

const priorityTone = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

function BoardColumn({
  status,
  label,
  enabled = true,
  actionTarget = false,
  children,
}: {
  status: OperationalTask["status"];
  label: string;
  enabled?: boolean;
  actionTarget?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !enabled });
  return (
    <section
      ref={setNodeRef}
      className={`min-w-60 rounded-[var(--radius-card)] bg-muted p-[15px] transition-colors ${
        actionTarget ? "border border-dashed border-primary/40 bg-primary/[0.035]" : ""
      } ${isOver ? "ring-2 ring-primary" : ""}`}
      aria-label={label}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
      </div>
      {actionTarget ? (
        <p className="mb-4 text-xs font-medium text-primary">
          Drop a reviewed task here
        </p>
      ) : null}
      <div className="flex flex-col gap-[15px]">{children}</div>
    </section>
  );
}

function DraggableTask({
  task,
  now,
  onOpen,
  onPause,
  onResume,
  canDrag = true,
  showDecisionHint = false,
}: {
  task: OperationalTask;
  now: number;
  onOpen: () => void;
  onPause?: () => void;
  onResume?: () => void;
  canDrag?: boolean;
  showDecisionHint?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled: !canDrag });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const activeTimer = task.status === "in-progress" && task.timer;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? "opacity-50"
          : "rounded-[var(--radius-card)] border border-border bg-card transition-shadow hover:shadow-[var(--shadow-card)]"
      }
    >
      <CardContent className="p-4">
        <div className="flex justify-between gap-2">
          <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
          {canDrag ? (
            <button
              type="button"
              className="rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Drag ${task.title}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 block text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {task.title}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {task.client} - due {task.dueDate}
        </p>
        {showDecisionHint ? (
          <p className="mt-3 text-xs font-medium text-primary">
            Drag to Returned or Done
          </p>
        ) : null}
        {activeTimer ? (
          <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium">
              {task.timer?.status === "active" ? "● Working" : "Paused"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Worked</p>
            <p className="font-mono text-sm font-semibold">
              {formatElapsed(taskWorkedMilliseconds(task, now))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.timer?.status === "active" ? (
                <Button size="sm" variant="outline" onClick={onPause}>
                  Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onResume}>
                  Resume
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onOpen}>
                Open
              </Button>
            </div>
          </div>
        ) : null}
        {task.blocked ? (
          <p className="mt-3 flex items-center gap-1 text-xs font-medium text-danger">
            <CircleAlert className="size-3.5" />
            Needs changes
          </p>
        ) : null}
      </CardContent>
    </div>
  );
}

export function TaskBoard({
  tasks,
  onStatusChange,
  onOpen,
  onPause,
  onResume,
  canDragTask,
  allowedDropStatuses,
  visibleStatuses,
  showBoardOnMobile = false,
}: {
  tasks: OperationalTask[];
  onStatusChange: (id: string, status: OperationalTask["status"]) => void;
  onOpen: (task: OperationalTask) => void;
  onPause?: (task: OperationalTask) => void;
  onResume?: (task: OperationalTask) => void;
  canDragTask?: (task: OperationalTask) => boolean;
  allowedDropStatuses?: readonly OperationalTask["status"][];
  visibleStatuses?: readonly OperationalTask["status"][];
  showBoardOnMobile?: boolean;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  React.useEffect(() => {
    if (!tasks.some((task) => task.timer?.status === "active")) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [tasks]);

  const visibleColumns = columns.filter(
    (column) => !visibleStatuses || visibleStatuses.includes(column.value),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const status = visibleColumns.find(
      (column) => column.value === event.over?.id,
    )?.value;
    if (
      status &&
      event.active.id !== event.over?.id &&
      (!allowedDropStatuses || allowedDropStatuses.includes(status))
    )
      onStatusChange(String(event.active.id), status);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div
        className={
          showBoardOnMobile
            ? "grid gap-[30px] overflow-x-auto pb-2"
            : "hidden gap-[30px] overflow-x-auto pb-2 lg:grid"
        }
        style={{
          gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(15rem, 1fr))`,
        }}
      >
        {visibleColumns.map((column) => (
          <BoardColumn
            key={column.value}
            status={column.value}
            enabled={!allowedDropStatuses || allowedDropStatuses.includes(column.value)}
            actionTarget={Boolean(
              allowedDropStatuses?.includes(column.value),
            )}
            label={`${column.label} (${tasks.filter((task) => task.status === column.value).length})`}
          >
            {tasks
              .filter((task) => task.status === column.value)
              .map((task) => (
                <DraggableTask
                  key={task.id}
                  task={task}
                  now={now}
                  onOpen={() => onOpen(task)}
                  onPause={() => onPause?.(task)}
                  onResume={() => onResume?.(task)}
                  canDrag={canDragTask?.(task) ?? true}
                  showDecisionHint={Boolean(
                    allowedDropStatuses?.length && (canDragTask?.(task) ?? true),
                  )}
                />
              ))}
          </BoardColumn>
        ))}
      </div>
    </DndContext>
  );
}

function taskWorkedMilliseconds(task: OperationalTask, now: number): number {
  const timer = task.timer;
  if (!timer) return 0;
  let seconds = timer.workedSeconds;
  if (timer.status === "active" && timer.activeSegmentStartedAt) {
    seconds += Math.max(
      0,
      Math.floor((now - new Date(timer.serverTime).getTime()) / 1000),
    );
  }
  return seconds * 1000;
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
