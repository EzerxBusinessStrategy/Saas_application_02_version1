"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { listTenantAdminActivity } from "@/features/tenant-admin/api/activity-api";
import {
  activityFilterOptions,
  buildActivityFeed,
  compactPeriodLabel,
  type ActivityFilter,
} from "@/components/tenant-administration/dashboard-activity";
import { TenantActivityList } from "@/components/tenant-administration/tenant-dashboard-activity";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function formatIsoDate(value: string): string {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

export function TenantActivityPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const query = useQuery({
    queryKey: ["tenant-admin-activity", from ?? "", to ?? ""],
    queryFn: () => listTenantAdminActivity({ from, to }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const feed = useMemo(
    () => buildActivityFeed(query.data?.events ?? [], filter, Number.POSITIVE_INFINITY),
    [filter, query.data?.events],
  );

  if (query.isPending) return <LoadingState label="Loading activity" rows={8} />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Activity could not load"
        description="The activity list for this period could not be retrieved."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { period, total } = query.data;
  const backHref =
    from && to ? `/admin?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "/admin";

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Activity"
        description={`Showing ${formatIsoDate(period.from)} – ${formatIsoDate(period.to)} (${compactPeriodLabel(period.from, period.to)}).`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to overview
            </Link>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>
              {total} {total === 1 ? "event" : "events"}
            </CardTitle>
            <CardDescription>Activity for the selected period.</CardDescription>
          </div>
          <Select
            className="h-8 w-[10.5rem] min-h-8 px-2 text-xs"
            aria-label="Filter activity"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ActivityFilter)}
          >
            {activityFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="px-0 pb-3 pt-0">
          {feed.rows.length === 0 ? (
            <div className="border-t px-4 py-6 sm:px-5">
              <EmptyState
                title={total === 0 ? "No activity in this period" : "No matching activity for this filter."}
                description="Adjust the date range on the dashboard or wait for recorded tenant events."
              />
            </div>
          ) : (
            <div className="border-t">
              <TenantActivityList rows={feed.rows} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
