"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export function DataTable<TData>({
  caption,
  columns,
  data,
  emptyTitle,
  emptyDescription,
  className,
  density = "default",
  onRowClick,
}: {
  caption: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
  density?: "default" | "compact";
  onRowClick?: (row: TData) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (data.length === 0)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full w-max text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-y text-sm text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap text-left font-medium",
                    density === "compact" ? "px-3 py-2" : "px-4 py-4",
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-b last:border-0",
                onRowClick ? "cursor-pointer hover:bg-muted/40" : null,
              )}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    "align-middle text-left",
                    density === "compact" ? "px-3 py-2" : "px-4 py-5",
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
