"use client";

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
import { CardContent } from "@/components/ui/card";
import type { OperationalTask } from "@/types/operations";

const columns: Array<{ value: OperationalTask["status"]; label: string }> = [
  { value: "to-do", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "rejected", label: "Rejected" },
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
  children,
}: {
  status: OperationalTask["status"];
  label: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`min-w-60 rounded-[var(--radius-card)] bg-muted p-[15px] ${isOver ? "ring-2 ring-primary" : ""}`}
      aria-label={label}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
      </div>
      <div className="flex flex-col gap-[15px]">{children}</div>
    </section>
  );
}

function DraggableTask({
  task,
  onOpen,
}: {
  task: OperationalTask;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
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
          <button
            type="button"
            className="rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Drag ${task.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 block text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {task.title}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {task.client} · due {task.dueDate}
        </p>
        {task.blocked ? (
          <p className="mt-3 flex items-center gap-1 text-xs font-medium text-danger">
            <CircleAlert className="size-3.5" />
            Blocked
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
}: {
  tasks: OperationalTask[];
  onStatusChange: (id: string, status: OperationalTask["status"]) => void;
  onOpen: (task: OperationalTask) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const onDragEnd = (event: DragEndEvent) => {
    const status = columns.find(
      (column) => column.value === event.over?.id,
    )?.value;
    if (status && event.active.id !== event.over?.id)
      onStatusChange(String(event.active.id), status);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="hidden gap-[30px] overflow-x-auto pb-2 lg:grid lg:grid-cols-5">
        {columns.map((column) => (
          <BoardColumn
            key={column.value}
            status={column.value}
            label={`${column.label} (${tasks.filter((task) => task.status === column.value).length})`}
          >
            {tasks
              .filter((task) => task.status === column.value)
              .map((task) => (
                <DraggableTask
                  key={task.id}
                  task={task}
                  onOpen={() => onOpen(task)}
                />
              ))}
          </BoardColumn>
        ))}
      </div>
    </DndContext>
  );
}
