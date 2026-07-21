"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const pageWindow = (page: number, pageCount: number) => {
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  const end = Math.min(pageCount, start + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
}) {
  const safePage = Math.max(1, Math.min(page, pageCount));
  const disabled = isLoading || pageCount <= 1;

  return (
    <nav
      className="flex flex-col gap-3 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
      aria-busy={isLoading}
    >
      <p className="text-muted-foreground" aria-live="polite">
        {isLoading
          ? "Loading records"
          : `${totalItems} ${totalItems === 1 ? "record" : "records"} · Page ${safePage} of ${pageCount}`}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <label className="hidden items-center gap-2 text-muted-foreground sm:flex">
            <span className="sr-only">Rows per page</span>
            <Select
              className="h-8 w-20 py-0 text-xs"
              value={pageSize}
              disabled={isLoading}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[5, 10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={disabled || safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Previous
          </span>
        </Button>
        <div
          className="hidden items-center gap-1 sm:flex"
          aria-label="Page numbers"
        >
          {pageWindow(safePage, pageCount).map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === safePage ? "default" : "outline"}
              size="sm"
              className="min-w-8 px-2"
              aria-current={pageNumber === safePage ? "page" : undefined}
              disabled={isLoading}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground sm:hidden">
          {safePage} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={disabled || safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          <span className="hidden sm:inline" aria-hidden="true">
            Next
          </span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
