"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || value === "No due date") return null;
  const iso = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return format(date, "MM/dd/yyyy");
}

export function isDateOutOfRange(date: Date, min?: string, max?: string): boolean {
  const iso = toIsoDate(date);
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

export const DATE_PICKER_POPOVER_WIDTH = 288;
export const DATE_PICKER_VIEWPORT_MARGIN = 8;

export function computeDatePickerPosition(input: {
  anchor: { top: number; bottom: number; left: number };
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  popoverWidth?: number;
  margin?: number;
}): { top: number; left: number; maxHeight: number } {
  const width = input.popoverWidth ?? DATE_PICKER_POPOVER_WIDTH;
  const margin = input.margin ?? DATE_PICKER_VIEWPORT_MARGIN;
  const maxHeight = Math.max(160, input.viewportHeight - margin * 2);
  const height = Math.min(Math.max(input.popoverHeight, 1), maxHeight);
  const spaceBelow = input.viewportHeight - input.anchor.bottom - margin;
  const spaceAbove = input.anchor.top - margin;
  const openAbove = spaceBelow < height && spaceAbove > spaceBelow;
  const left = Math.min(
    Math.max(margin, input.anchor.left),
    Math.max(margin, input.viewportWidth - width - margin),
  );
  const rawTop = openAbove ? input.anchor.top - height - margin : input.anchor.bottom + margin;
  const top = Math.min(Math.max(margin, rawTop), input.viewportHeight - height - margin);
  return { top, left, maxHeight };
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled = false,
  readOnly = false,
  required = false,
  id,
  name,
  className,
  placeholder = "MM/DD/YYYY",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const locked = disabled || readOnly;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={locked}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-required={required || undefined}
        onClick={() => {
          if (!locked) setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border bg-input px-3 text-left text-sm shadow-[0_1px_1px_rgb(0_0_0/0.05)] outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring",
          ariaInvalid && "border-danger focus-visible:ring-danger",
          locked && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" ? (
        <DatePickerPopover
          anchorRef={triggerRef}
          popoverRef={popoverRef}
          selected={selected}
          min={min}
          max={max}
          onSelect={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClear={() => {
            onChange("");
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DatePickerPopover({
  anchorRef,
  popoverRef,
  selected,
  min,
  max,
  onSelect,
  onClear,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  selected: Date | null;
  min?: string;
  max?: string;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected ?? today));
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 360 });

  useEffect(() => {
    setVisibleMonth(startOfMonth(selected ?? today));
  }, [selected, today]);

  useLayoutEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition(
        computeDatePickerPosition({
          anchor: { top: rect.top, bottom: rect.bottom, left: rect.left },
          popoverHeight: popoverRef.current?.offsetHeight || 360,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      );
    }
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, popoverRef, monthMenuOpen, visibleMonth]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 }),
  });

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Choose date"
      data-date-picker-popover=""
      className="pointer-events-auto fixed z-[200] w-72 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-card p-3 text-card-foreground shadow-[var(--shadow-card)]"
      style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-1.5 py-1 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Choose month and year"
          aria-expanded={monthMenuOpen}
          onClick={() => setMonthMenuOpen((current) => !current)}
        >
          {format(visibleMonth, "MMMM yyyy")}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
        <div className="flex items-center">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous month"
            onClick={() => {
              setMonthMenuOpen(false);
              setVisibleMonth((current) => addMonths(current, -1));
            }}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next month"
            onClick={() => {
              setMonthMenuOpen(false);
              setVisibleMonth((current) => addMonths(current, 1));
            }}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      {monthMenuOpen ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Previous year"
              onClick={() => setVisibleMonth((current) => addYears(current, -1))}
            >
              <ChevronUp className="size-4" />
            </button>
            <p className="text-sm font-semibold">{format(visibleMonth, "yyyy")}</p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Next year"
              onClick={() => setVisibleMonth((current) => addYears(current, 1))}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((month, index) => {
              const active = visibleMonth.getMonth() === index;
              return (
                <button
                  key={month}
                  type="button"
                  className={cn(
                    "rounded-[var(--radius-control)] px-2 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  onClick={() => {
                    setVisibleMonth(new Date(visibleMonth.getFullYear(), index, 1));
                    setMonthMenuOpen(false);
                  }}
                >
                  {month.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <p key={weekday} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                {weekday}
              </p>
            ))}
            {days.map((day) => {
              const iso = toIsoDate(day);
              const outside = !isSameMonth(day, visibleMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);
              const blocked = isDateOutOfRange(day, min, max);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={blocked}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  aria-label={format(day, "MMMM d, yyyy")}
                  onClick={() => onSelect(iso)}
                  className={cn(
                    "mx-auto flex size-8 items-center justify-center rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    outside && "text-muted-foreground",
                    !outside && "text-foreground",
                    isToday && !isSelected && "font-semibold",
                    isSelected && "bg-primary text-primary-foreground ring-1 ring-foreground",
                    !isSelected && !blocked && "hover:bg-muted",
                    blocked && "cursor-not-allowed opacity-40",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isDateOutOfRange(today, min, max)}
              onClick={() => onSelect(toIsoDate(today))}
            >
              Today
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
