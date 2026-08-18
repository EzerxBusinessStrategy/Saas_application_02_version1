"use client";

import { getTimeOfDayGreeting } from "@/lib/dashboard-greeting";
import { cn } from "@/lib/utils";

type DashboardGreetingBannerProps = {
  userName: string;
  organizationName?: string;
  subtitle?: string;
  className?: string;
};

export function DashboardGreetingBanner({
  userName,
  organizationName,
  subtitle,
  className,
}: DashboardGreetingBannerProps) {
  const greeting = getTimeOfDayGreeting();
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-primary/20 bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f2744] px-6 py-5 text-white shadow-sm",
        className,
      )}
      aria-label="Dashboard greeting"
    >
      <p className="text-xl font-semibold tracking-tight sm:text-2xl">
        {greeting}, {firstName}
      </p>
      {subtitle ? (
        <p className="mt-1 text-sm text-white/75">{subtitle}</p>
      ) : organizationName ? (
        <p className="mt-1 text-sm text-white/75">{organizationName}</p>
      ) : null}
    </section>
  );
}
