"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTone = "neutral" | "info" | "success" | "warning" | "danger";

type ExecutiveKpiCardProps = {
  label: string;
  value: string;
  valueTitle?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat" | "neutral";
  detail?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  href?: string;
  ariaLabel?: string;
};

const toneStyles: Record<
  KpiTone,
  { icon: string; trend: string; border: string }
> = {
  neutral: {
    icon: "bg-muted text-muted-foreground",
    trend: "text-muted-foreground",
    border: "border-border/80",
  },
  info: {
    icon: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    trend: "text-sky-700 dark:text-sky-300",
    border: "border-border/80",
  },
  success: {
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    trend: "text-emerald-700 dark:text-emerald-300",
    border: "border-border/80",
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    trend: "text-amber-700 dark:text-amber-300",
    border: "border-border/80",
  },
  danger: {
    icon: "bg-red-500/10 text-red-700 dark:text-red-300",
    trend: "text-red-700 dark:text-red-300",
    border: "border-border/80",
  },
};

function TrendGlyph({ direction }: { direction: ExecutiveKpiCardProps["trendDirection"] }) {
  if (direction === "up") return <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />;
  if (direction === "down") return <ArrowDownRight className="size-3.5 shrink-0" aria-hidden="true" />;
  if (direction === "neutral") return <Check className="size-3.5 shrink-0" aria-hidden="true" />;
  return <Minus className="size-3.5 shrink-0" aria-hidden="true" />;
}

function ExecutiveKpiCardBody({
  label,
  value,
  valueTitle,
  trend,
  trendDirection = "flat",
  detail,
  icon: Icon,
  tone = "neutral",
  href,
}: ExecutiveKpiCardProps) {
  const styles = toneStyles[tone];
  const isInteractive = Boolean(href);

  return (
    <article
      className={cn(
        "group relative flex h-[196px] min-h-[196px] flex-col rounded-[14px] border bg-card p-6 transition-[box-shadow,border-color] duration-200",
        styles.border,
        isInteractive && "hover:border-border hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
            styles.icon,
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      </div>

      <p
        className="mt-3 text-[32px] font-semibold leading-none tracking-tight text-foreground"
        title={valueTitle}
      >
        {value}
      </p>

      {trend ? (
        <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", styles.trend)}>
          <TrendGlyph direction={trendDirection} />
          <span>{trend}</span>
        </p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : <span />}
        {isInteractive ? (
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            View →
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function ExecutiveKpiCard(props: ExecutiveKpiCardProps) {
  if (!props.href) {
    return <ExecutiveKpiCardBody {...props} />;
  }

  return (
    <Link
      href={props.href}
      prefetch={false}
      aria-label={props.ariaLabel ?? `View ${props.label}`}
      className="relative z-0 block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <ExecutiveKpiCardBody {...props} />
    </Link>
  );
}

export function DashboardKpiSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/80" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function TenantDashboardKpiSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div key={card} className="h-[196px] animate-pulse rounded-[14px] bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
