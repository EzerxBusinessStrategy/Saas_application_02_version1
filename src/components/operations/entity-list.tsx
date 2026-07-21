"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { entities } from "@/mocks/operations";

export function EntityList({ title }: { title: string }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      entities.filter((entity) =>
        entity.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  return (
    <div className="flex flex-col gap-[30px]">
      <div>
        <p className="text-sm font-medium text-primary">Operations</p>
        <h1 className="mt-1 text-[28px] leading-[34px] font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Searchable, server-ready records scoped to the active tenant.
        </p>
      </div>
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{title}</CardTitle>
          <label className="relative block">
            <span className="sr-only">Search {title}</span>
            <Search className="pointer-events-none absolute left-[15px] top-3 size-[18px] text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}`}
              className="w-full pl-10 sm:w-64"
            />
          </label>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title={`No ${title.toLowerCase()} found`}
              description="Try a different search term or clear your filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {title} for the current tenant
                </caption>
                <thead className="border-y text-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-4 font-medium">Name</th>
                    <th className="px-4 py-4 font-medium">Owner</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entity) => (
                    <tr key={entity.id} className="border-b last:border-0">
                      <td className="px-4 py-5 font-medium">{entity.name}</td>
                      <td className="px-4 py-5 text-muted-foreground">
                        {entity.owner}
                      </td>
                      <td className="px-4 py-5">
                        <StatusBadge status={entity.status} />
                      </td>
                      <td className="px-4 py-5 text-muted-foreground">
                        {entity.updated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
