import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/types/domain";
import { cn } from "@/lib/utils";

type MetricCardVariant = "strip" | "elevated";

function TrendIconForMetric({ trend }: { trend?: Metric["trend"] }) {
  if (trend === "up") return ArrowUpRight;
  if (trend === "down") return ArrowDownRight;
  return Minus;
}

function StripMetricContent({ metric }: { metric: Metric }) {
  const TrendIcon = TrendIconForMetric({ trend: metric.trend });

  return (
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
            <TrendIcon className="mr-1 size-3.5" aria-hidden="true" />
            {metric.change}
          </span>
        ) : null}
      </div>
    </CardContent>
  );
}

function ElevatedMetricContent({
  metric,
  icon: Icon,
  isInteractive,
}: {
  metric: Metric;
  icon?: LucideIcon;
  isInteractive: boolean;
}) {
  const TrendIcon = TrendIconForMetric({ trend: metric.trend });
  const trendTone =
    metric.trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : metric.trend === "down"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <CardContent className="flex h-full flex-1 flex-col pt-8 pb-[30px] px-[30px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {Icon ? (
          <div
            className={cn(
              "mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200",
              isInteractive && "group-hover:bg-primary/15",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </div>
        ) : null}

        <strong className="block truncate text-[28px] leading-[34px] font-bold tracking-tight text-foreground">
          {metric.value}
        </strong>
        <p className="mt-1 text-sm font-medium text-foreground/90">{metric.label}</p>

        <p className={cn("mt-2 min-h-8 text-xs leading-relaxed", trendTone)}>
          {metric.change ? (
            <span className="inline-flex items-start gap-1">
              <TrendIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{metric.change}</span>
            </span>
          ) : null}
        </p>

        <span className="mt-auto inline-flex min-h-5 items-center gap-1 pt-3 text-xs font-medium text-primary">
          {isInteractive ? (
            <>
              View details
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </>
          ) : null}
        </span>
      </div>
    </CardContent>
  );
}

export function MetricCard({
  metric,
  className,
  href,
  ariaLabel,
  icon,
  variant = "strip",
  animationIndex,
}: {
  metric: Metric;
  className?: string;
  href?: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  variant?: MetricCardVariant;
  animationIndex?: number;
}) {
  const reduceMotion = useReducedMotion();
  const isInteractive = Boolean(href);
  const isElevated = variant === "elevated";

  const card = (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden transition-[box-shadow,border-color] duration-200",
        isElevated && [
          "border-border/70 shadow-sm",
          isInteractive &&
            "group cursor-pointer hover:border-primary/25 hover:shadow-md focus-within:border-primary/25 focus-within:shadow-md",
          !isInteractive && "hover:border-border hover:shadow-md",
        ],
        className,
      )}
    >
      {isElevated ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary/80" />
      ) : null}

      {isElevated ? (
        <ElevatedMetricContent metric={metric} icon={icon} isInteractive={isInteractive} />
      ) : (
        <StripMetricContent metric={metric} />
      )}
    </Card>
  );

  const wrapped = href ? (
    <Link
      href={href}
      aria-label={ariaLabel ?? `View ${metric.label}`}
      className={cn(
        "flex h-full rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !isElevated && "transition-colors hover:bg-muted/40",
      )}
    >
      {card}
    </Link>
  ) : (
    card
  );

  if (animationIndex === undefined || reduceMotion) {
    return <div className="h-full min-h-0">{wrapped}</div>;
  }

  return (
    <motion.div
      className="h-full min-h-0"
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.42,
        delay: animationIndex * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {wrapped}
    </motion.div>
  );
}
