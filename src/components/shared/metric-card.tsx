import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/types/domain";

export function MetricCard({
  metric,
  className,
}: {
  metric: Metric;
  className?: string;
}) {
  const Icon =
    metric.trend === "up"
      ? ArrowUpRight
      : metric.trend === "down"
        ? ArrowDownRight
        : Minus;
  return (
    <Card className={className}>
      <CardContent className="p-[30px]">
        <div className="flex items-end justify-between gap-2">
          <div>
            <strong className="block text-[28px] leading-[34px] font-bold tracking-tight">
              {metric.value}
            </strong>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {metric.label}
            </p>
          </div>
          {metric.change ? (
            <span className="inline-flex items-center text-xs text-muted-foreground">
              <Icon
                className="mr-1 size-3.5"
                aria-hidden="true"
              />
              {metric.change}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
