"use client";

import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export const THEME_ANIMATION_COOLDOWN_MS = 45 * 1000;
export const THEME_ANIMATION_STORAGE_KEY = "ezerx-theme-transition-at";
export const THEME_DARK_TRANSITION_DURATION_MS = 2800;
const THEME_LIGHT_TRANSITION_DURATION_MS = 900;

type ThemeMode = "light" | "dark";
type ThemeTransitionOrigin = { x: number; y: number };
type ThemeTransitionStyle = CSSProperties &
  Record<"--theme-transition-origin-x" | "--theme-transition-origin-y", string>;
type ShootingStarStyle = CSSProperties &
  Record<"--star-start-x" | "--star-start-y" | "--star-travel-x" | "--star-travel-y" | "--star-delay", string>;

const shootingStars: Array<{ id: string; style: ShootingStarStyle }> = [
  { id: "star-1", style: { "--star-start-x": "102vw", "--star-start-y": "8vh", "--star-travel-x": "-125vw", "--star-travel-y": "72vh", "--star-delay": "0ms" } },
  { id: "star-2", style: { "--star-start-x": "112vw", "--star-start-y": "22vh", "--star-travel-x": "-118vw", "--star-travel-y": "64vh", "--star-delay": "160ms" } },
  { id: "star-3", style: { "--star-start-x": "86vw", "--star-start-y": "-8vh", "--star-travel-x": "-98vw", "--star-travel-y": "82vh", "--star-delay": "360ms" } },
  { id: "star-4", style: { "--star-start-x": "72vw", "--star-start-y": "-12vh", "--star-travel-x": "-82vw", "--star-travel-y": "68vh", "--star-delay": "520ms" } },
  { id: "star-5", style: { "--star-start-x": "118vw", "--star-start-y": "42vh", "--star-travel-x": "-130vw", "--star-travel-y": "52vh", "--star-delay": "680ms" } },
];

export function shouldPlayThemeTransition(now: number, lastTransitionAt: string | null): boolean {
  const lastTimestamp = Number(lastTransitionAt);
  return !Number.isFinite(lastTimestamp) || now - lastTimestamp >= THEME_ANIMATION_COOLDOWN_MS;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

function ThemeTransitionOverlay({ mode, origin, onComplete }: { mode: ThemeMode; origin: ThemeTransitionOrigin; onComplete: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, mode === "dark" ? THEME_DARK_TRANSITION_DURATION_MS : THEME_LIGHT_TRANSITION_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [mode, onComplete]);

  return (
    <div
      aria-hidden="true"
      className={cn("theme-transition-overlay", mode === "dark" ? "theme-transition-overlay--dark" : "theme-transition-overlay--light")}
      style={{ "--theme-transition-origin-x": `${origin.x}px`, "--theme-transition-origin-y": `${origin.y}px` } as ThemeTransitionStyle}
    >
      {mode === "dark" ? shootingStars.map((star) => <span key={star.id} className="theme-shooting-star" data-shooting-star={star.id} style={star.style} />) : null}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [transition, setTransition] = useState<ThemeMode | null>(null);
  const [transitionOrigin, setTransitionOrigin] = useState<ThemeTransitionOrigin>({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();
  // next-themes can resolve the browser preference before hydration completes.
  // Keep the first client render identical to the server-rendered fallback.
  const isDark = mounted && resolvedTheme === "dark";
  const completeTransition = useCallback(() => setTransition(null), []);

  useEffect(() => setMounted(true), []);

  const changeTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const nextTheme: ThemeMode = isDark ? "light" : "dark";
    const now = Date.now();
    setTransition(null);
    if (!reducedMotion && shouldPlayThemeTransition(now, window.localStorage.getItem(THEME_ANIMATION_STORAGE_KEY))) {
      const bounds = event.currentTarget.getBoundingClientRect();
      setTransitionOrigin({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
      window.localStorage.setItem(THEME_ANIMATION_STORAGE_KEY, String(now));
      setTransition(nextTheme);
    }
    setTheme(nextTheme);
  };

  const actionLabel = `Switch to ${isDark ? "light" : "dark"} mode`;
  return (
    <>
      <button
        aria-checked={mounted && isDark}
        aria-label={mounted ? actionLabel : "Theme preference is loading"}
        className="bb8-theme-toggle"
        data-theme={isDark ? "dark" : "light"}
        disabled={!mounted}
        onClick={changeTheme}
        role="switch"
        type="button"
      >
        <span aria-hidden="true" className="bb8-theme-toggle__scene">
          <span className="bb8-theme-toggle__cloud bb8-theme-toggle__cloud--one" />
          <span className="bb8-theme-toggle__cloud bb8-theme-toggle__cloud--two" />
          <span className="bb8-theme-toggle__stars"><i /><i /><i /><i /><i /></span>
          <span className="bb8-theme-toggle__droid">
            <span className="bb8-theme-toggle__head"><i /><b /></span>
            <span className="bb8-theme-toggle__body"><i /><i /><i /></span>
          </span>
        </span>
        <span className="bb8-theme-toggle__tooltip">{actionLabel}</span>
      </button>
      <span className="sr-only" aria-live="polite">{mounted ? (isDark ? "Dark mode enabled" : "Light mode enabled") : ""}</span>
      {transition ? <ThemeTransitionOverlay mode={transition} origin={transitionOrigin} onComplete={completeTransition} /> : null}
    </>
  );
}
