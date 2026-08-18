"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  listTenantAdminTaskOptions,
  listTenantAdminTasks,
} from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { TaskCalendarDetailDrawer } from "@/components/operations/task-calendar/task-calendar-detail-drawer";
import {
  TaskCalendarEventCard,
  TaskCalendarOverflowList,
} from "@/components/operations/task-calendar/task-calendar-event-card";
import {
  calendarDays,
  calendarHeading,
  calendarSummary,
  filterCalendarTasks,
  formatAgendaHeading,
  formatTaskDueTime,
  navigateCalendar,
  taskStatusOptions,
  tasksForDay,
  tasksForMonth,
  tasksForWeek,
  toCalendarTasks,
  visibleTasksPerDay,
  weekdayLabels,
  weekDays,
  type CalendarFilters,
  type CalendarTask,
  type CalendarView,
} from "@/components/operations/task-calendar/task-calendar-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const defaultFilters: CalendarFilters = {
  search: "",
  employeeId: "",
  clientId: "",
  status: "all",
  priority: "all",
};

type TaskCalendarWorkspaceProps = {
  variant?: "page" | "embedded";
  initialClientId?: string;
  initialEmployeeId?: string;
};

export function TaskCalendarWorkspace({
  variant = "page",
  initialClientId = "",
  initialEmployeeId = "",
}: TaskCalendarWorkspaceProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfMonth(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>({
    ...defaultFilters,
    clientId: initialClientId,
    employeeId: initialEmployeeId,
  });

  const tasksQuery = useQuery({
    queryKey: ["tenant-task-calendar", initialClientId ?? ""],
    queryFn: () => listTenantAdminTasks(initialClientId || undefined),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const optionsQuery = useQuery({
    queryKey: ["tenant-task-calendar-options"],
    queryFn: listTenantAdminTaskOptions,
    staleTime: 60_000,
  });

  const calendarTasks = useMemo(
    () => filterCalendarTasks(toCalendarTasks(tasksQuery.data ?? []), filters),
    [filters, tasksQuery.data],
  );

  const visibleTasks = useMemo(() => {
    if (view === "week") return tasksForWeek(calendarTasks, focusDate);
    return tasksForMonth(calendarTasks, focusDate);
  }, [calendarTasks, focusDate, view]);

  const summary = useMemo(() => calendarSummary(visibleTasks), [visibleTasks]);
  const selectedTask = calendarTasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.employeeId ? 1 : 0) +
    (filters.clientId ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0);

  const employeeName =
    optionsQuery.data?.employees.find((employee) => employee.id === filters.employeeId)?.name ?? "";
  const clientName =
    optionsQuery.data?.clients.find((client) => client.id === filters.clientId)?.name ?? "";

  function resetFilters() {
    setFilters({ ...defaultFilters, clientId: initialClientId, employeeId: initialEmployeeId });
  }

  function selectTask(task: CalendarTask) {
    setSelectedTaskId(task.id);
  }

  if (tasksQuery.isPending) {
    return variant === "page" ? (
      <LoadingState label="Loading task calendar" rows={6} />
    ) : (
      <Card>
        <CardContent className="py-10">
          <LoadingState label="Loading task calendar" rows={4} />
        </CardContent>
      </Card>
    );
  }

  if (tasksQuery.isError) {
    return (
      <ErrorState
        title="Task calendar could not load"
        description="The current tenant tasks could not be retrieved."
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  const toolbar = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 px-0"
            aria-label="Previous period"
            onClick={() => setFocusDate((current) => navigateCalendar(view, current, "prev"))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-[10rem] text-center text-lg font-semibold tracking-tight">
            {calendarHeading(view, focusDate)}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 px-0"
            aria-label="Next period"
            onClick={() => setFocusDate((current) => navigateCalendar(view, current, "next"))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setFocusDate(view === "month" ? startOfMonth(today) : today);
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch view={view} onChange={setView} />
          {variant === "page" ? (
            <Link
              href="/admin/tasks"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              <Plus className="size-4" aria-hidden="true" />
              New task
            </Link>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void tasksQuery.refetch()}
            disabled={tasksQuery.isFetching}
          >
            <RefreshCw className={cn("size-4", tasksQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="font-medium text-foreground">
          {view === "week" ? "Week overview" : `${format(focusDate, "MMMM")} overview`}
        </p>
        <Badge tone="info">{summary.open} Open</Badge>
        <Badge tone="success">{summary.completed} Completed</Badge>
        <Badge tone={summary.overdue > 0 ? "danger" : "neutral"}>{summary.overdue} Overdue</Badge>
      </div>
    </div>
  );

  const filterBar = (
    <FilterToolbar
      activeFilterCount={activeFilterCount}
      onClear={resetFilters}
      filterGridClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
    >
      <label className="text-sm font-medium xl:col-span-2">
        Search
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            aria-label="Search calendar tasks"
          />
        </div>
      </label>
      <label className="text-sm font-medium">
        Employee
        <Select
          className="mt-1"
          value={filters.employeeId}
          onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value }))}
          aria-label="Filter calendar by employee"
        >
          <option value="">All employees</option>
          {(optionsQuery.data?.employees ?? [])
            .filter((employee) => employee.employmentStatus === "active")
            .map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Client
        <Select
          className="mt-1"
          value={filters.clientId}
          onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}
          aria-label="Filter calendar by client"
        >
          <option value="">All clients</option>
          {(optionsQuery.data?.clients ?? []).map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Status
        <Select
          className="mt-1"
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          aria-label="Filter calendar by status"
        >
          <option value="all">All statuses</option>
          {taskStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Priority
        <Select
          className="mt-1"
          value={filters.priority}
          onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
          aria-label="Filter calendar by priority"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </label>
    </FilterToolbar>
  );

  const filterChips =
    activeFilterCount > 0 ? (
      <div className="flex flex-wrap gap-2">
        {filters.search ? (
          <FilterChip label={`Search: ${filters.search}`} onRemove={() => setFilters((c) => ({ ...c, search: "" }))} />
        ) : null}
        {filters.employeeId ? (
          <FilterChip label={employeeName || "Employee"} onRemove={() => setFilters((c) => ({ ...c, employeeId: "" }))} />
        ) : null}
        {filters.clientId ? (
          <FilterChip label={clientName || "Client"} onRemove={() => setFilters((c) => ({ ...c, clientId: "" }))} />
        ) : null}
        {filters.status !== "all" ? (
          <FilterChip
            label={filters.status.replaceAll("_", " ")}
            onRemove={() => setFilters((c) => ({ ...c, status: "all" }))}
          />
        ) : null}
        {filters.priority !== "all" ? (
          <FilterChip
            label={filters.priority}
            onRemove={() => setFilters((c) => ({ ...c, priority: "all" }))}
          />
        ) : null}
      </div>
    ) : null;

  const calendarBody = (
    <>
      {view === "month" ? (
        <MonthCalendarView
          focusDate={focusDate}
          tasks={calendarTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={selectTask}
        />
      ) : null}
      {view === "week" ? (
        <WeekCalendarView focusDate={focusDate} tasks={calendarTasks} onSelectTask={selectTask} />
      ) : null}
      {view === "agenda" ? (
        <AgendaCalendarView focusDate={focusDate} tasks={calendarTasks} onSelectTask={selectTask} />
      ) : null}
    </>
  );

  const workspace = (
    <>
      {toolbar}
      {filterBar}
      {filterChips}
      <Card>
        <CardContent className="p-0">{calendarBody}</CardContent>
      </Card>
      <TaskCalendarDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />
    </>
  );

  if (variant === "embedded") {
    return <div className="flex flex-col gap-4">{workspace}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Task calendar"
        description="Plan, track and manage scheduled client work."
      />
      {workspace}
    </div>
  );
}

function ViewSwitch({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  const options: CalendarView[] = ["month", "week", "agenda"];
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={view === option ? "default" : "ghost"}
          className="h-8 px-3 capitalize"
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

function MonthCalendarView({
  focusDate,
  tasks,
  selectedTaskId,
  onSelectTask,
}: {
  focusDate: Date;
  tasks: readonly CalendarTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: CalendarTask) => void;
}) {
  const days = calendarDays(focusDate);
  const today = new Date();
  const todayWeekday = today.getDay();
  const showTodayColumn = isSameMonth(today, focusDate);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {weekdayLabels.map((weekday, index) => {
            const isTodayColumn = showTodayColumn && index === todayWeekday;
            return (
              <p
                key={weekday}
                className={cn(
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                  isTodayColumn ? "text-primary" : "text-muted-foreground",
                )}
              >
                {weekday}
              </p>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <MonthDayCell
              key={day.toISOString()}
              day={day}
              month={focusDate}
              tasks={tasksForDay(tasks, day)}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              highlightColumn={showTodayColumn && day.getDay() === todayWeekday}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthDayCell({
  day,
  month,
  tasks,
  selectedTaskId,
  onSelectTask,
  highlightColumn = false,
}: {
  day: Date;
  month: Date;
  tasks: CalendarTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: CalendarTask) => void;
  highlightColumn?: boolean;
}) {
  const currentMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const visible = tasks.slice(0, visibleTasksPerDay);
  const overflow = tasks.slice(visibleTasksPerDay);

  return (
    <div
      className={cn(
        "min-h-[7rem] border-b border-r p-2 align-top",
        !currentMonth && "bg-muted/15 text-muted-foreground",
        highlightColumn && !today && "bg-primary/[0.03]",
        today && "bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold",
            today && "bg-primary text-primary-foreground",
          )}
        >
          {format(day, "d")}
        </span>
        {tasks.length > 0 ? (
          <span className="text-[10px] font-medium text-muted-foreground">{tasks.length} tasks</span>
        ) : null}
      </div>
      {today ? <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Today</p> : null}
      <div className="mt-1.5 space-y-1">
        {visible.map((task) => (
          <TaskCalendarEventCard
            key={task.id}
            task={task}
            compact
            selected={selectedTaskId === task.id}
            onSelect={onSelectTask}
          />
        ))}
        {overflow.length ? (
          <TaskCalendarOverflowList tasks={overflow} onSelectTask={onSelectTask} />
        ) : null}
      </div>
    </div>
  );
}

function WeekCalendarView({
  focusDate,
  tasks,
  onSelectTask,
}: {
  focusDate: Date;
  tasks: readonly CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
}) {
  const days = weekDays(focusDate);
  const weekTasks = tasksForWeek(tasks, focusDate);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {days.map((day) => {
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={cn("border-r px-3 py-2", today && "bg-primary/5")}>
                <p className={cn("text-xs font-semibold uppercase", today ? "text-primary" : "text-muted-foreground")}>
                  {format(day, "EEE")}
                </p>
                <p className={cn("text-lg font-semibold", today && "text-primary")}>{format(day, "d")}</p>
              </div>
            );
          })}
        </div>
        <div className="grid min-h-[18rem] grid-cols-7">
          {days.map((day) => {
            const dayTasks = tasksForDay(weekTasks, day).sort(
              (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
            );
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={cn("space-y-2 border-r p-2", today && "bg-primary/5")}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">All day</p>
                {dayTasks.length ? (
                  dayTasks.map((task) => (
                    <div key={task.id} className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">{formatTaskDueTime(task.dueDate)}</p>
                      <TaskCalendarEventCard task={task} compact onSelect={onSelectTask} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No tasks</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaCalendarView({
  focusDate,
  tasks,
  onSelectTask,
}: {
  focusDate: Date;
  tasks: readonly CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
}) {
  const monthTasks = tasksForMonth(tasks, focusDate).sort(
    (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
  );
  const grouped = monthTasks.reduce<Map<string, CalendarTask[]>>((accumulator, task) => {
    const key = format(task.dueDate, "yyyy-MM-dd");
    const bucket = accumulator.get(key) ?? [];
    bucket.push(task);
    accumulator.set(key, bucket);
    return accumulator;
  }, new Map());

  if (!monthTasks.length) {
    return (
      <div className="p-8">
        <EmptyState
          title="No scheduled tasks"
          description="Tasks with due dates in this period will appear here."
        />
      </div>
    );
  }

  return (
    <div className="divide-y">
      {[...grouped.entries()].map(([key, dayTasks]) => {
        const day = dayTasks[0]!.dueDate;
        return (
          <section key={key} className="px-4 py-4 sm:px-6">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
              {formatAgendaHeading(day)}
            </h3>
            <div className="mt-3 space-y-3">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="flex w-full items-start gap-4 rounded-md border px-3 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <time className="w-16 shrink-0 text-sm font-medium tabular-nums">
                    {formatTaskDueTime(task.dueDate)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {task.clientName} · {task.assignees[0]?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <Badge tone="neutral">{task.priority}</Badge>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium"
    >
      {label}
      <X className="size-3" aria-hidden="true" />
    </button>
  );
}
