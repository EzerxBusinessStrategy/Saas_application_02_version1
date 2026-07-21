"use client";

import { useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function FilterToolbar({
  search,
  children,
  trailing,
  activeFilterCount = 0,
  onClear,
  disabled = false,
}: {
  search?: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder: string;
  };
  children?: ReactNode;
  trailing?: ReactNode;
  activeFilterCount?: number;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filters = children ? (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        {search ? (
          <label className="relative block">
            <span className="sr-only">{search.label}</span>
            <Search className="pointer-events-none absolute left-[15px] top-3 size-[18px] text-muted-foreground" />
            <Input
              value={search.value}
              disabled={disabled}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder}
              className="pl-10"
            />
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          {trailing}
          {filters ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                disabled={disabled}
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
              {onClear && activeFilterCount ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={onClear}
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear all
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {filters ? <div className="hidden sm:block">{filters}</div> : null}
      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent
          title="Filter records"
          description="Choose one or more filters to refine the current list."
          className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none"
        >
          <div className="pr-8">
            <h2 className="font-semibold">Filter records</h2>
            <div className="mt-5 grid gap-3">{children}</div>
            {onClear && activeFilterCount ? (
              <Button
                variant="outline"
                className="mt-5 w-full"
                onClick={() => {
                  onClear();
                  setMobileFiltersOpen(false);
                }}
              >
                Clear all filters
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
