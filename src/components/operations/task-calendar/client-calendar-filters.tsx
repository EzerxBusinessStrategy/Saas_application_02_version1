"use client";

import { ChevronDown } from "lucide-react";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { SearchableFilterSelect } from "@/components/shared/searchable-filter-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  CalendarDueWindow,
  CalendarFilters,
  ClientCalendarBucket,
} from "@/components/operations/task-calendar/task-calendar-utils";

const dueWindowOptions: ReadonlyArray<{ value: CalendarDueWindow; label: string }> = [
  { value: "due_today", label: "Due today" },
  { value: "next_7", label: "Next 7 days" },
  { value: "next_30", label: "Next 30 days" },
  { value: "overdue", label: "Overdue" },
  { value: "no_due", label: "No due date" },
];

const frequencyOptions: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All frequencies" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annual" },
  { value: "one_time", label: "One-time" },
];

const quickWindows: ReadonlyArray<{ value: CalendarDueWindow; label: string }> = [
  { value: "all", label: "All" },
  { value: "due_soon", label: "Due soon" },
  { value: "overdue", label: "Overdue" },
  { value: "this_month", label: "This month" },
];

export function ClientCalendarKpiCards({
  scheduled,
  inProgress,
  completed,
  selected,
  onToggle,
}: {
  scheduled: number;
  inProgress: number;
  completed: number;
  selected: ClientCalendarBucket;
  onToggle: (bucket: Exclude<ClientCalendarBucket, "all" | "overdue">) => void;
}) {
  const cards = [
    { bucket: "scheduled" as const, label: "Scheduled", value: scheduled, tone: "info" as const },
    { bucket: "in_progress" as const, label: "In progress", value: inProgress, tone: "warning" as const },
    { bucket: "completed" as const, label: "Completed", value: completed, tone: "success" as const },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const pressed = selected === card.bucket;
        return (
          <button
            key={card.bucket}
            type="button"
            aria-label={`${card.label}, ${card.value}`}
            aria-pressed={pressed}
            onClick={() => onToggle(card.bucket)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[var(--radius-card)]"
          >
            <Card className={cn(pressed && "ring-2 ring-primary")}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <span
                  className={cn(
                    "inline-flex min-h-5 min-w-8 items-center justify-center rounded-full px-2 text-xs font-medium",
                    card.tone === "info" && "bg-accent text-accent-foreground",
                    card.tone === "warning" && "bg-[var(--chip-warning-bg)] text-warning",
                    card.tone === "success" && "bg-[var(--chip-success-bg)] text-success",
                  )}
                >
                  {card.value}
                </span>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

export function ClientCalendarFilterBar({
  filters,
  onChange,
  onClear,
  services,
  assignees,
  activeFilterCount,
}: {
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  onClear: () => void;
  services: readonly { id: string; name: string }[];
  assignees: readonly { id: string; name: string }[];
  activeFilterCount: number;
}) {
  const moreCount =
    (filters.dueWindow !== "all" && !quickWindows.some((option) => option.value === filters.dueWindow) ? 1 : 0) +
    (filters.frequency !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <FilterToolbar
        search={{
          value: filters.search,
          onChange: (value) => onChange({ ...filters, search: value }),
          label: "Search calendar tasks",
          placeholder: "Search tasks...",
        }}
        activeFilterCount={activeFilterCount}
        onClear={onClear}
        filterGridClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        <SearchableFilterSelect
          label="Service"
          ariaLabel="Filter calendar by service"
          value={filters.serviceName}
          onChange={(value) => onChange({ ...filters, serviceName: value })}
          options={services}
          emptyLabel="All services"
          placeholder="Search services..."
        />
        <SearchableFilterSelect
          label="Assigned to"
          ariaLabel="Filter calendar by assignee"
          value={filters.employeeId}
          onChange={(value) => onChange({ ...filters, employeeId: value })}
          options={assignees}
          emptyLabel="All team members"
          placeholder="Search team members..."
        />
        <div className="flex flex-col gap-1 text-sm font-medium">
          More filters
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 justify-between font-normal">
                {moreCount ? `${moreCount} selected` : "Due window, frequency"}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Due window</DropdownMenuLabel>
              {dueWindowOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() =>
                    onChange({
                      ...filters,
                      dueWindow: filters.dueWindow === option.value ? "all" : option.value,
                    })
                  }
                >
                  {option.label}
                  {filters.dueWindow === option.value ? " ✓" : ""}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Frequency</DropdownMenuLabel>
              {frequencyOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => onChange({ ...filters, frequency: option.value })}
                >
                  {option.label}
                  {filters.frequency === option.value ? " ✓" : ""}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {["all", "normal", "high", "urgent"].map((value) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => onChange({ ...filters, priority: value })}
                >
                  {value === "all" ? "All priorities" : value.replace(/^\w/, (letter) => letter.toUpperCase())}
                  {filters.priority === value ? " ✓" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </FilterToolbar>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {quickWindows.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filters.dueWindow === option.value ? "default" : "outline"}
              className="h-8"
              onClick={() => onChange({ ...filters, dueWindow: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

export function dueWindowLabel(window: CalendarDueWindow): string {
  switch (window) {
    case "all":
      return "All";
    case "due_soon":
      return "Due soon";
    case "overdue":
      return "Overdue";
    case "this_month":
      return "This month";
    case "due_today":
      return "Due today";
    case "next_7":
      return "Next 7 days";
    case "next_30":
      return "Next 30 days";
    case "no_due":
      return "No due date";
    default: {
      const exhaustive: never = window;
      return exhaustive;
    }
  }
}

export function frequencyChipLabel(frequency: string): string {
  switch (frequency) {
    case "all":
      return "All frequencies";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annually":
      return "Annual";
    case "one_time":
      return "One-time";
    default:
      return frequency;
  }
}

export function clientBucketLabel(bucket: ClientCalendarBucket): string {
  switch (bucket) {
    case "all":
      return "All";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    default: {
      const exhaustive: never = bucket;
      return exhaustive;
    }
  }
}
