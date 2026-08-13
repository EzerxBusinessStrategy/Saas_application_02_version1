"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { defaultLocale, localeForFormatting, timezones, type AppLocale, type AppTimezone } from "@/i18n/config";
import { updateUserPreferences } from "@/features/identity/api/user-preferences-api";

type ClockPreferences = {
  readonly locale: AppLocale;
  readonly timezone: AppTimezone;
};

function clockForTimezone(timezone: AppTimezone) {
  return timezones.find((clock) => clock.timezone === timezone) ?? timezones[0];
}

export function LiveWorldClock({ preferences }: { preferences?: ClockPreferences }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const locale = preferences?.locale ?? defaultLocale;
  const savedTimezone = preferences?.timezone ?? timezones[0].timezone;
  const [selected, setSelected] = useState(() => clockForTimezone(savedTimezone));
  const [now, setNow] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    setSelected(clockForTimezone(savedTimezone));
  }, [savedTimezone]);

  const syncServerTime = useCallback(async () => {
    try {
      const requestStartedAt = Date.now();
      const response = await fetch("/api/system/time", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not synchronize time.");
      const data = (await response.json()) as { timestamp: number };
      const requestFinishedAt = Date.now();
      serverOffsetRef.current = data.timestamp - (requestStartedAt + (requestFinishedAt - requestStartedAt) / 2);
      setNow(new Date(Date.now() + serverOffsetRef.current));
    } catch {
      setNow(new Date());
    }
  }, []);

  useEffect(() => {
    void syncServerTime();
    const interval = window.setInterval(() => void syncServerTime(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [syncServerTime]);

  useEffect(() => {
    const updateClock = () => {
      const correctedNow = Date.now() + serverOffsetRef.current;
      setNow(new Date(correctedNow));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeForFormatting(locale), { timeZone: selected.timezone, weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
    [locale, selected.timezone],
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeForFormatting(locale), { timeZone: selected.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    [locale, selected.timezone],
  );
  const timezoneFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeForFormatting(locale), { timeZone: selected.timezone, timeZoneName: "short", hour: "2-digit" }),
    [locale, selected.timezone],
  );
  const timezoneName = useMemo(() => now ? timezoneFormatter.formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? "" : "", [now, timezoneFormatter]);

  async function selectClock(next: (typeof timezones)[number]) {
    if (next.timezone === selected.timezone || saving) return;
    setSaving(true);
    try {
      await updateUserPreferences({ locale, timezone: next.timezone });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hidden items-center gap-1.5 lg:flex">
      <div className="min-w-[132px] text-right">
        {now ? (
          <>
            <div className="text-[10px] leading-4 text-muted-foreground">{dateFormatter.format(now)}</div>
            <div className="font-mono text-[11px] font-semibold leading-3 tabular-nums text-foreground">{timeFormatter.format(now)}</div>
          </>
        ) : <div className="h-7" aria-hidden="true" />}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex min-w-[116px] flex-col items-start rounded-[var(--radius-control)] px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label="Select clock country"
          disabled={saving}
        >
          <span className="flex items-center gap-1 whitespace-nowrap">{selected.country} ({selected.city})<ChevronDown className="size-3" aria-hidden="true" /></span>
          {timezoneName ? <span className="text-[9px] leading-none opacity-70">{timezoneName}</span> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {timezones.map((clock) => (
            <DropdownMenuItem
              key={clock.code}
              className="flex cursor-pointer items-center justify-between"
              disabled={saving}
              onSelect={() => void selectClock(clock)}
            >
              <span className="flex flex-col"><span className="font-medium">{clock.country}</span><span className="text-xs text-muted-foreground">{clock.city}</span></span>
              {clock.timezone === selected.timezone ? <Check className="size-4" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
