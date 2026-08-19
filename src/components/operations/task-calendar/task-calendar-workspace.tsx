"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
  calendarQueryRange,
  calendarSummary,
  clientCalendarSummary,
  defaultCalendarFilters,
  filterCalendarTasks,
  formatAgendaHeading,
  formatTaskDueTime,
  humanise,
  navigateCalendar,
  taskStatusOptions,
  tasksForDay,
  tasksForMonth,
  tasksForWeek,
  toCalendarTasks,
  toClientCalendarTasks,
  visibleTasksPerCell,
  weekdayLabels,
  weekDays,
  clientTaskStatusLabel,
  type CalendarAudience,
  type CalendarFilters,
  type CalendarTask,
  type CalendarView,
} from "@/components/operations/task-calendar/task-calendar-utils";
import {
  ClientCalendarFilterBar,
  ClientCalendarKpiCards,
  clientBucketLabel,
  dueWindowLabel,
  frequencyChipLabel,
} from "@/components/operations/task-calendar/client-calendar-filters";
import { getClientPortalTaskCalendar } from "@/features/client-portal/api/client-portal-task-calendar-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const defaultFilters: CalendarFilters = defaultCalendarFilters();

type TaskCalendarWorkspaceProps = {
  variant?: "page" | "embedded";
  audience?: CalendarAudience;
  initialClientId?: string;
  initialEmployeeId?: string;
};

export function TaskCalendarWorkspace({
  variant = "page",
  audience = "tenant",
  initialClientId = "",
  initialEmployeeId = "",
}: TaskCalendarWorkspaceProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const compact = variant === "embedded";
  const [filters, setFilters] = useState<CalendarFilters>({
    ...defaultFilters,
    clientId: initialClientId,
    employeeId: initialEmployeeId,
  });

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      clientId: initialClientId,
      employeeId: initialEmployeeId,
    }));
  }, [initialClientId, initialEmployeeId]);

  const queryRange = useMemo(() => calendarQueryRange(view, focusDate), [focusDate, view]);
  const isClient = audience === "client";

  const tenantTasksQuery = useQuery({
    queryKey: ["tenant-task-calendar", initialClientId ?? ""],
    queryFn: () => listTenantAdminTasks(initialClientId || undefined),
    enabled: !isClient,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const clientTasksQuery = useQuery({
    queryKey: ["client-task-calendar", queryRange.from, queryRange.to],
    queryFn: () => getClientPortalTaskCalendar(queryRange),
    enabled: isClient,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const tasksQuery = isClient ? clientTasksQuery : tenantTasksQuery;

  const optionsQuery = useQuery({
    queryKey: ["tenant-task-calendar-options"],
    queryFn: listTenantAdminTaskOptions,
    enabled: !isClient,
    staleTime: 60_000,
  });

  const mappedTasks = useMemo(() => {
    return isClient
      ? toClientCalendarTasks(clientTasksQuery.data?.tasks ?? [])
      : toCalendarTasks(tenantTasksQuery.data ?? []);
  }, [clientTasksQuery.data?.tasks, isClient, tenantTasksQuery.data]);

  const calendarTasks = useMemo(
    () => filterCalendarTasks(mappedTasks, filters),
    [filters, mappedTasks],
  );

  const kpiTasks = useMemo(
    () =>
      filterCalendarTasks(mappedTasks, {
        ...filters,
        clientBucket: "all",
        dueWindow: "all",
      }),
    [filters, mappedTasks],
  );

  const visibleTasks = useMemo(() => {
    if (view === "week") return tasksForWeek(calendarTasks, focusDate);
    return tasksForMonth(calendarTasks, focusDate);
  }, [calendarTasks, focusDate, view]);

  const selectedDayTasks = useMemo(
    () => tasksForDay(calendarTasks, selectedDay),
    [calendarTasks, selectedDay],
  );
  const summary = useMemo(() => calendarSummary(visibleTasks), [visibleTasks]);
  const clientKpi = useMemo(() => {
    const periodTasks = view === "week" ? tasksForWeek(kpiTasks, focusDate) : tasksForMonth(kpiTasks, focusDate);
    return clientCalendarSummary(periodTasks);
  }, [focusDate, kpiTasks, view]);
  const selectedTask = calendarTasks.find((task) => task.id === selectedTaskId) ?? null;
  const clientServices = useMemo(() => {
    const names = [...new Set(mappedTasks.map((task) => task.serviceName).filter(Boolean))];
    return names.sort((left, right) => left.localeCompare(right)).map((name) => ({ id: name, name }));
  }, [mappedTasks]);
  const clientAssignees = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of mappedTasks) {
      for (const assignee of task.assignees) {
        if (!byId.has(assignee.id)) byId.set(assignee.id, assignee.name);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [mappedTasks]);
  const activeFilterCount = isClient
    ? (filters.search ? 1 : 0) +
      (filters.serviceName ? 1 : 0) +
      (filters.employeeId ? 1 : 0) +
      (filters.clientBucket !== "all" ? 1 : 0) +
      (filters.dueWindow !== "all" ? 1 : 0) +
      (filters.frequency !== "all" ? 1 : 0) +
      (filters.priority !== "all" ? 1 : 0)
    : (filters.search ? 1 : 0) +
      (filters.employeeId ? 1 : 0) +
      (filters.clientId ? 1 : 0) +
      (filters.status !== "all" ? 1 : 0) +
      (filters.priority !== "all" ? 1 : 0);

  const employeeName =
    optionsQuery.data?.employees.find((employee) => employee.id === filters.employeeId)?.name ??
    clientAssignees.find((assignee) => assignee.id === filters.employeeId)?.name ??
    "";
  const clientName =
    optionsQuery.data?.clients.find((client) => client.id === filters.clientId)?.name ?? "";

  function resetFilters() {
    setFilters({ ...defaultFilters, clientId: initialClientId, employeeId: initialEmployeeId });
  }

  function selectTask(task: CalendarTask) {
    setSelectedTaskId(task.id);
    setSelectedDay(task.dueDate);
  }

  function selectDay(day: Date) {
    setSelectedDay(day);
  }

  function movePeriod(direction: "prev" | "next") {
    setFocusDate((current) => {
      const next = navigateCalendar(view, current, direction);
      if (view === "month" && !isSameMonth(selectedDay, next)) {
        setSelectedDay(startOfMonth(next));
      }
      return next;
    });
  }

  if (tasksQuery.isPending) {
    return variant === "page" ? (
      <LoadingState label="Loading task calendar" rows={6} />
    ) : (
      <LoadingState label="Loading task calendar" rows={4} />
    );
  }

  if (tasksQuery.isError) {
    return (
      <ErrorState
        title="Task calendar could not load"
        description={
          isClient
            ? "Your scheduled tasks could not be retrieved."
            : "The current tenant tasks could not be retrieved."
        }
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  const toolbar = (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", compact && "gap-1.5")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          aria-label="Previous period"
          onClick={() => movePeriod("prev")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className={cn("min-w-[8.5rem] text-center font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
          {calendarHeading(view, focusDate)}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          aria-label="Next period"
          onClick={() => movePeriod("next")}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            const today = new Date();
            setSelectedDay(today);
            setFocusDate(view === "month" ? startOfMonth(today) : today);
          }}
        >
          Today
        </Button>
        {compact || isClient ? null : (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="sr-only">
              {view === "week" ? "Week overview" : `${format(focusDate, "MMMM")} overview`}
            </span>
            <Badge tone="info">{summary.open} Open</Badge>
            <Badge tone="success">{summary.completed} Completed</Badge>
            <Badge tone={summary.overdue > 0 ? "danger" : "neutral"}>{summary.overdue} Overdue</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ViewSwitch view={view} onChange={setView} compact={compact} />
        {compact && !isClient ? (
          <Link
            href="/admin/task-calendar"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open calendar
          </Link>
        ) : compact ? null : (
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            aria-label="Refresh calendar"
            onClick={() => void tasksQuery.refetch()}
            disabled={tasksQuery.isFetching}
          >
            <RefreshCw className={cn("size-4", tasksQuery.isFetching && "animate-spin")} />
          </Button>
        )}
      </div>
    </div>
  );

  const compactFilters = (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Select
        className="h-8 min-h-8 px-2 text-xs"
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
      <Select
        className="h-8 min-h-8 px-2 text-xs"
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
      <Select
        className="h-8 min-h-8 px-2 text-xs"
        value={filters.status}
        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
        aria-label="Filter calendar by status"
      >
        <option value="all">All statuses</option>
        {taskStatusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </Select>
      <Select
        className="h-8 min-h-8 px-2 text-xs"
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
    </div>
  );

  const filterBar = isClient ? (
    <ClientCalendarFilterBar
      filters={filters}
      onChange={setFilters}
      onClear={resetFilters}
      services={clientServices}
      assignees={clientAssignees}
      activeFilterCount={activeFilterCount}
    />
  ) : compact ? compactFilters : (
    <FilterToolbar
      search={{
        value: filters.search,
        onChange: (value) => setFilters((current) => ({ ...current, search: value })),
        label: "Search calendar tasks",
        placeholder: "Search tasks...",
      }}
      activeFilterCount={activeFilterCount}
      onClear={resetFilters}
      filterGridClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
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
            <option key={status.value} value={status.value}>
              {status.label}
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
      <div className="flex flex-col gap-2">
        {isClient ? <p className="text-xs font-medium text-muted-foreground">Active filters</p> : null}
        <div className="flex flex-wrap items-center gap-2">
        {filters.search ? (
          <FilterChip label={filters.search} onRemove={() => setFilters((c) => ({ ...c, search: "" }))} />
        ) : null}
        {isClient && filters.serviceName ? (
          <FilterChip label={filters.serviceName} onRemove={() => setFilters((c) => ({ ...c, serviceName: "" }))} />
        ) : null}
        {filters.employeeId ? (
          <FilterChip label={employeeName || "Assigned"} onRemove={() => setFilters((c) => ({ ...c, employeeId: "" }))} />
        ) : null}
        {!isClient && filters.clientId ? (
          <FilterChip label={clientName || "Client"} onRemove={() => setFilters((c) => ({ ...c, clientId: "" }))} />
        ) : null}
        {isClient && filters.clientBucket !== "all" ? (
          <FilterChip
            label={clientBucketLabel(filters.clientBucket)}
            onRemove={() => setFilters((c) => ({ ...c, clientBucket: "all" }))}
          />
        ) : null}
        {isClient && filters.dueWindow !== "all" ? (
          <FilterChip
            label={dueWindowLabel(filters.dueWindow)}
            onRemove={() => setFilters((c) => ({ ...c, dueWindow: "all" }))}
          />
        ) : null}
        {isClient && filters.frequency !== "all" ? (
          <FilterChip
            label={frequencyChipLabel(filters.frequency)}
            onRemove={() => setFilters((c) => ({ ...c, frequency: "all" }))}
          />
        ) : null}
        {!isClient && filters.status !== "all" ? (
          <FilterChip
            label={taskStatusOptions.find((status) => status.value === filters.status)?.label ?? filters.status}
            onRemove={() => setFilters((c) => ({ ...c, status: "all" }))}
          />
        ) : null}
        {filters.priority !== "all" ? (
          <FilterChip
            label={filters.priority.replace(/^\w/, (letter) => letter.toUpperCase())}
            onRemove={() => setFilters((c) => ({ ...c, priority: "all" }))}
          />
        ) : null}
        {isClient ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
            Clear all
          </Button>
        ) : null}
        </div>
      </div>
    ) : null;

  const calendarBody = (
    <>
      {view === "month" ? (
        <MonthCalendarView
          audience={audience}
          compact={compact}
          focusDate={focusDate}
          tasks={calendarTasks}
          selectedDay={selectedDay}
          selectedTaskId={selectedTaskId}
          onSelectDay={selectDay}
          onSelectTask={selectTask}
        />
      ) : null}
      {view === "week" ? (
        <WeekCalendarView
          audience={audience}
          compact={compact}
          focusDate={focusDate}
          tasks={calendarTasks}
          onSelectTask={selectTask}
        />
      ) : null}
      {view === "agenda" ? (
        <AgendaCalendarView
          audience={audience}
          focusDate={focusDate}
          tasks={calendarTasks}
          onSelectTask={selectTask}
        />
      ) : null}
    </>
  );

  const drawer = (
    <TaskCalendarDetailDrawer
      audience={audience}
      task={selectedTask}
      open={Boolean(selectedTask)}
      onOpenChange={(open) => {
        if (!open) setSelectedTaskId(null);
      }}
    />
  );

  const calendarPanel =
    view === "agenda" ? (
      <div className="overflow-hidden rounded-md border">{calendarBody}</div>
    ) : (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
        <div className="overflow-hidden rounded-md border">{calendarBody}</div>
        <SelectedDayPanel
          audience={audience}
          day={selectedDay}
          tasks={selectedDayTasks}
          onSelectTask={selectTask}
        />
      </div>
    );

  if (variant === "embedded") {
    return (
      <div className="flex flex-col gap-2">
        {toolbar}
        {filterBar}
        {calendarPanel}
        {drawer}
      </div>
    );
  }

  const workspace = (
    <>
      {isClient ? (
        <ClientCalendarKpiCards
          scheduled={clientKpi.scheduled}
          inProgress={clientKpi.inProgress}
          completed={clientKpi.completed}
          selected={filters.clientBucket}
          onToggle={(bucket) =>
            setFilters((current) => ({
              ...current,
              clientBucket: current.clientBucket === bucket ? "all" : bucket,
            }))
          }
        />
      ) : null}
      {filterBar}
      {filterChips}
      {toolbar}
      {isClient ? (
        calendarPanel
      ) : (
        <Card>
          <CardContent className="p-0">{calendarBody}</CardContent>
        </Card>
      )}
      {drawer}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        eyebrow={isClient ? "Client portal" : "Operations"}
        title="Task calendar"
        description={
          isClient
            ? "Track due dates, assigned team members, and live task status for your services."
            : "Plan, track and manage scheduled client work."
        }
      />
      {workspace}
    </div>
  );
}

function ViewSwitch({
  view,
  onChange,
  compact = false,
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
  compact?: boolean;
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
          className={cn("capitalize", compact ? "h-7 px-2 text-xs" : "h-8 px-3")}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

function MonthCalendarView({
  audience = "tenant",
  compact = false,
  focusDate,
  tasks,
  selectedDay,
  selectedTaskId,
  onSelectDay,
  onSelectTask,
}: {
  audience?: CalendarAudience;
  compact?: boolean;
  focusDate: Date;
  tasks: readonly CalendarTask[];
  selectedDay: Date;
  selectedTaskId: string | null;
  onSelectDay: (day: Date) => void;
  onSelectTask: (task: CalendarTask) => void;
}) {
  const days = calendarDays(focusDate);
  const today = new Date();
  const todayWeekday = today.getDay();
  const showTodayColumn = isSameMonth(today, focusDate);

  return (
    <div className="overflow-x-auto">
      <div className={compact ? "min-w-[36rem]" : "min-w-[960px]"}>
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {weekdayLabels.map((weekday, index) => {
            const isTodayColumn = showTodayColumn && index === todayWeekday;
            return (
              <p
                key={weekday}
                className={cn(
                  "px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  isTodayColumn ? "text-primary" : "text-muted-foreground",
                )}
              >
                {compact ? weekday.slice(0, 2) : weekday}
              </p>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <MonthDayCell
              key={day.toISOString()}
              audience={audience}
              compact={compact}
              day={day}
              month={focusDate}
              tasks={tasksForDay(tasks, day)}
              selected={isSameDay(day, selectedDay)}
              selectedTaskId={selectedTaskId}
              onSelectDay={onSelectDay}
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
  audience = "tenant",
  compact = false,
  day,
  month,
  tasks,
  selected,
  selectedTaskId,
  onSelectDay,
  onSelectTask,
  highlightColumn = false,
}: {
  audience?: CalendarAudience;
  compact?: boolean;
  day: Date;
  month: Date;
  tasks: CalendarTask[];
  selected: boolean;
  selectedTaskId: string | null;
  onSelectDay: (day: Date) => void;
  onSelectTask: (task: CalendarTask) => void;
  highlightColumn?: boolean;
}) {
  const currentMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const limit = visibleTasksPerCell(compact);
  const visible = tasks.slice(0, limit);
  const overflow = tasks.slice(limit);
  const dayLabel = format(day, "EEEE, d MMMM yyyy");

  return (
    <div
      className={cn(
        "relative isolate border-b border-r align-top transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        compact ? (audience === "client" ? "min-h-[6.75rem] p-1" : "min-h-[4.25rem] p-1") : "min-h-[5.5rem] p-1.5",
        !currentMonth && !selected && "bg-muted/15 text-muted-foreground",
        highlightColumn && !today && !selected && "bg-primary/[0.03]",
        today && "bg-primary/5",
        selected && "z-[1] bg-primary/10 shadow-[inset_0_0_0_2px_var(--primary)]",
        !selected && "hover:bg-muted/30",
      )}
    >
      <button
        type="button"
        aria-label={tasks.length ? `${dayLabel}, ${tasks.length} tasks` : dayLabel}
        aria-pressed={selected}
        aria-current={today ? "date" : undefined}
        onClick={() => onSelectDay(day)}
        className="absolute inset-0 z-0 cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-200 motion-reduce:transition-none",
            compact ? "size-5 text-[11px]" : "size-6 text-xs",
            today && "bg-primary text-primary-foreground",
          )}
        >
          {format(day, "d")}
        </span>
        {tasks.length > 0 ? (
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {compact ? tasks.length : `${tasks.length} tasks`}
          </span>
        ) : null}
      </div>
      {compact || !today ? null : (
        <p className="pointer-events-none relative z-10 mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Today
        </p>
      )}
      <div className="relative z-10 mt-1 flex flex-col gap-1">
        {visible.map((task) => (
          <TaskCalendarEventCard
            key={task.id}
            audience={audience}
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
  audience = "tenant",
  compact = false,
  focusDate,
  tasks,
  onSelectTask,
}: {
  audience?: CalendarAudience;
  compact?: boolean;
  focusDate: Date;
  tasks: readonly CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
}) {
  const days = weekDays(focusDate);
  const weekTasks = tasksForWeek(tasks, focusDate);

  return (
    <div className="overflow-x-auto">
      <div className={compact ? "min-w-[36rem]" : "min-w-[960px]"}>
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {days.map((day) => {
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={cn("border-r px-2 py-1.5", today && "bg-primary/5")}>
                <p className={cn("text-[11px] font-semibold uppercase", today ? "text-primary" : "text-muted-foreground")}>
                  {format(day, "EEE")}
                </p>
                <p className={cn("text-base font-semibold", today && "text-primary")}>{format(day, "d")}</p>
              </div>
            );
          })}
        </div>
        <div className={cn("grid grid-cols-7", compact ? "min-h-[8rem]" : "min-h-[14rem]")}>
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
                      <TaskCalendarEventCard audience={audience} task={task} compact onSelect={onSelectTask} />
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
  audience = "tenant",
  focusDate,
  tasks,
  onSelectTask,
}: {
  audience?: CalendarAudience;
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
          <section key={key} className="px-4 py-3 sm:px-5">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
              {formatAgendaHeading(day)}
            </h3>
            <div className="mt-2 space-y-2">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/40"
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
                  <Badge tone="neutral">
                    {audience === "client" ? clientTaskStatusLabel(task) : humanise(task.priority)}
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SelectedDayPanel({
  audience = "tenant",
  day,
  tasks,
  onSelectTask,
}: {
  audience?: CalendarAudience;
  day: Date;
  tasks: readonly CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
}) {
  const heading = isSameDay(day, new Date())
    ? `Today · ${format(day, "d MMM")}`
    : format(day, "EEE d MMM");

  return (
    <aside className="rounded-md border p-3">
      <h3 className="text-sm font-semibold">{heading}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
      </p>
      <div className="mt-3 flex max-h-[18rem] flex-col gap-2 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled work on this day.</p>
        ) : (
          tasks.map((task) => (
            <TaskCalendarEventCard key={task.id} audience={audience} task={task} compact onSelect={onSelectTask} />
          ))
        )}
      </div>
    </aside>
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
