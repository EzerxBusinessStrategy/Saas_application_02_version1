"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ComposedChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getOperationalWorkspace } from "@/features/operations/api/operations-api";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  chartAxisTick,
  chartTooltipCursor,
  ChartTooltipContent,
} from "@/components/dashboard/chart-tooltip";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";

const trendChartMargin = { top: 8, right: 20, bottom: 8, left: 8 };
const trendXAxisPadding = { left: 18, right: 18 };

export function ReportsWorkspace() {
  const query = useQuery({
    queryKey: ["operational-reports"],
    queryFn: () => getOperationalWorkspace("admin"),
  });
  if (query.isPending)
    return <LoadingState label="Loading operational reports" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Operational reports could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const tasks = query.data.tasks;
  const statusData = ["to-do", "in-progress", "review", "done"].map(
    (status) => ({
      status: status.replaceAll("-", " "),
      tasks: tasks.filter((task) => task.status === status).length,
    }),
  );
  const slaData = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => ({
    day,
    compliance: 94 - index * 2,
  }));
  const productivityData = tasks.map((task) => ({
    name: task.assignee.split(" ")[0],
    checklist: task.checklist.filter((item) => item.complete).length,
    total: task.checklist.length,
  }));
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Reports"
        title="Operational reports"
        description="Use task, SLA, and delivery signals to decide where authorised follow-up is needed."
      />
      <section className="grid gap-[30px] xl:grid-cols-2">
        <ChartCard
          title="Task completion trend"
          description="Completed delivery checkpoints during the current work week."
        >
          <div
            role="img"
            aria-label="Task completion rose from 88 percent on Monday to 94 percent on Friday."
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slaData} margin={trendChartMargin}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  padding={trendXAxisPadding}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[80, 100]}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={chartTooltipCursor}
                />
                <Line
                  type="monotone"
                  dataKey="compliance"
                  name="Completion"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Completion is a delivery-health signal, not an employee speed
            target.
          </p>
        </ChartCard>
        <ChartCard
          title="Task status distribution"
          description="Open and completed work by operational status."
        >
          <div
            role="img"
            aria-label={statusData
              .map((item) => `${item.status}: ${item.tasks} tasks`)
              .join(", ")}
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="status"
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={chartTooltipCursor}
                />
                <Bar
                  activeBar={{
                    fill: "var(--primary)",
                    opacity: 0.88,
                    stroke: "var(--ring)",
                    strokeWidth: 1,
                  }}
                  dataKey="tasks"
                  name="Tasks"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the task list for exact records and actions.
          </p>
        </ChartCard>
        <ChartCard
          title="SLA compliance trend"
          description="Percentage of active delivery work within its agreed response window."
        >
          <div
            role="img"
            aria-label="SLA compliance decreased from 94 percent to 86 percent over five reporting days."
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={slaData} margin={trendChartMargin}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  padding={trendXAxisPadding}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[80, 100]}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={chartTooltipCursor}
                />
                <Line
                  type="monotone"
                  dataKey="compliance"
                  name="SLA compliance"
                  stroke="var(--warning)"
                  strokeWidth={3}
                  dot={false}
                />
                <Scatter
                  dataKey="compliance"
                  name="SLA checkpoint"
                  fill="var(--warning)"
                  line={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Review at-risk tasks before changing delivery commitments.
          </p>
        </ChartCard>
        <ChartCard
          title="Workforce utilisation"
          description="Checklist progress by assigned employee for active work."
        >
          <div
            role="img"
            aria-label={productivityData
              .map(
                (item) =>
                  `${item.name}: ${item.checklist} of ${item.total} checkpoints complete`,
              )
              .join(", ")}
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityData}>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={chartAxisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={chartTooltipCursor}
                />
                <Bar
                  activeBar={{
                    fill: "var(--primary)",
                    opacity: 0.88,
                    stroke: "var(--ring)",
                    strokeWidth: 1,
                  }}
                  dataKey="checklist"
                  name="Completed checkpoints"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            This report measures assigned delivery progress, not time worked or
            profitability.
          </p>
        </ChartCard>
      </section>
    </div>
  );
}
