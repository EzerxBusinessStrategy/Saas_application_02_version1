"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { HeaderUtilityButton } from "@/components/app-shell/header-utility-button";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const actionLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <>
      <HeaderUtilityButton
        aria-label={mounted ? actionLabel : "Appearance"}
        title={mounted ? actionLabel : "Appearance"}
        disabled={!mounted}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        <Sun
          className={cn(
            "absolute size-[18px] transition-all duration-200 motion-reduce:transition-none",
            isDark ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            "absolute size-[18px] transition-all duration-200 motion-reduce:transition-none",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0",
          )}
          aria-hidden="true"
        />
      </HeaderUtilityButton>
      <span className="sr-only" aria-live="polite">
        {mounted ? (isDark ? "Dark mode enabled" : "Light mode enabled") : ""}
      </span>
    </>
  );
}
