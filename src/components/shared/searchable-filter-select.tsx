"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableFilterOption = {
  id: string;
  name: string;
};

export function SearchableFilterSelect({
  label,
  ariaLabel,
  value,
  onChange,
  options,
  emptyLabel,
  placeholder = "Search...",
  disabled = false,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchableFilterOption[];
  emptyLabel: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(query) ||
        option.id.toLowerCase().includes(query),
    );
  }, [options, search]);

  const selected = options.find((option) => option.id === value);

  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="truncate">{selected?.name ?? emptyLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        {open ? (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label={`${label} search`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={placeholder}
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
              {filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm hover:bg-muted",
                      option.id === value && "bg-muted/70 font-medium",
                    )}
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    {option.name}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}
