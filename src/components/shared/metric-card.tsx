import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/types/domain";
import { cn } from "@/lib/utils";

export function MetricCard({
  metric,
  className,
  href,
  ariaLabel,
}: {
  metric: Metric;
  className?: string;
  href?: string;
  ariaLabel?: string;
}) {
  const Icon =
    metric.trend === "up"
      ? ArrowUpRight
      : metric.trend === "down"
        ? ArrowDownRight
        : Minus;

  const content = (
    <CardContent className="p-[30px]">
      <div className="flex items-end justify-between gap-2">
        <div>
          <strong className="block text-[28px] leading-[34px] font-bold tracking-tight">
            {metric.value}
          </strong>
          <p className="mt-0.5 text-sm text-muted-foreground">{metric.label}</p>
        </div>
        {metric.change ? (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <Icon className="mr-1 size-3.5" aria-hidden="true" />
            {metric.change}
          </span>
        ) : null}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `View ${metric.label}`}
        className={cn(
          "block transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Card className={cn("h-full", className)}>{content}</Card>
      </Link>
    );
  }

  return <Card className={className}>{content}</Card>;
}
