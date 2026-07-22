"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Sun } from "lucide-react";
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
  Record<
    | "--star-start-x"
    | "--star-start-y"
    | "--star-travel-x"
    | "--star-travel-y"
    | "--star-angle"
    | "--star-delay"
    | "--star-duration"
    | "--star-scale"
    | "--star-trail-length",
    string
  >;

const shootingStars: Array<{ id: string; style: ShootingStarStyle }> = [
  {
    id: "star-1",
    style: {
      "--star-start-x": "102vw",
      "--star-start-y": "8vh",
      "--star-travel-x": "-125vw",
      "--star-travel-y": "72vh",
      "--star-angle": "150deg",
      "--star-delay": "0ms",
      "--star-duration": "2100ms",
      "--star-scale": "1",
      "--star-trail-length": "150px",
    },
  },
  {
    id: "star-2",
    style: {
      "--star-start-x": "112vw",
      "--star-start-y": "22vh",
      "--star-travel-x": "-118vw",
      "--star-travel-y": "64vh",
      "--star-angle": "151deg",
      "--star-delay": "160ms",
      "--star-duration": "1780ms",
      "--star-scale": "0.82",
      "--star-trail-length": "120px",
    },
  },
  {
    id: "star-3",
    style: {
      "--star-start-x": "86vw",
      "--star-start-y": "-8vh",
      "--star-travel-x": "-98vw",
      "--star-travel-y": "82vh",
      "--star-angle": "140deg",
      "--star-delay": "360ms",
      "--star-duration": "2200ms",
      "--star-scale": "1.1",
      "--star-trail-length": "170px",
    },
  },
  {
    id: "star-4",
    style: {
      "--star-start-x": "72vw",
      "--star-start-y": "-12vh",
      "--star-travel-x": "-82vw",
      "--star-travel-y": "68vh",
      "--star-angle": "140deg",
      "--star-delay": "520ms",
      "--star-duration": "1880ms",
      "--star-scale": "0.72",
      "--star-trail-length": "105px",
    },
  },
  {
    id: "star-5",
    style: {
      "--star-start-x": "118vw",
      "--star-start-y": "42vh",
      "--star-travel-x": "-130vw",
      "--star-travel-y": "52vh",
      "--star-angle": "158deg",
      "--star-delay": "680ms",
      "--star-duration": "1680ms",
      "--star-scale": "0.65",
      "--star-trail-length": "95px",
    },
  },
];

export function shouldPlayThemeTransition(
  now: number,
  lastTransitionAt: string | null,
): boolean {
  const lastTimestamp = Number(lastTransitionAt);
  return (
    !Number.isFinite(lastTimestamp) ||
    now - lastTimestamp >= THEME_ANIMATION_COOLDOWN_MS
  );
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

function useDocumentVisible() {
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return documentVisible;
}

function DarkModeOwlIcon({ documentVisible }: { documentVisible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="theme-toggle__owl size-5"
      data-document-visible={documentVisible}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="theme-toggle__owl-body"
        d="M6 11.5 7.2 5l4.1 3.2h9.4L24.8 5l1.2 6.5c1.5 2 2.3 4.45 2.3 7.1 0 6.25-5.45 10.4-12.3 10.4S3.7 24.85 3.7 18.6c0-2.65.8-5.1 2.3-7.1Z"
        fill="var(--theme-owl-body)"
      />
      <path
        className="theme-toggle__owl-face"
        d="M8.1 16.15c0-3.7 3.32-6.5 7.9-6.5s7.9 2.8 7.9 6.5c0 4.38-3.32 8.08-7.9 8.08s-7.9-3.7-7.9-8.08Z"
        fill="var(--theme-owl-face)"
      />
      <path
        className="theme-toggle__owl-feather"
        d="M10.4 11.55c1.18 1.2 1.85 2.38 2.02 3.55M21.6 11.55c-1.18 1.2-1.85 2.38-2.02 3.55"
        fill="none"
        stroke="var(--theme-owl-highlight)"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <circle
        className="theme-toggle__owl-eye-outer"
        cx="11.7"
        cy="16.55"
        r="3.35"
        fill="var(--theme-owl-eye)"
      />
      <circle
        className="theme-toggle__owl-eye-outer"
        cx="20.3"
        cy="16.55"
        r="3.35"
        fill="var(--theme-owl-eye)"
      />
      <circle
        className="theme-toggle__owl-pupil"
        cx="11.7"
        cy="16.55"
        r="1.35"
        fill="var(--theme-owl-pupil)"
      />
      <circle
        className="theme-toggle__owl-pupil"
        cx="20.3"
        cy="16.55"
        r="1.35"
        fill="var(--theme-owl-pupil)"
      />
      <path
        className="theme-toggle__owl-eyelid theme-toggle__owl-eyelid--left"
        d="M8.35 16.55a3.35 3.35 0 0 1 6.7 0Z"
        fill="var(--theme-owl-lid)"
      />
      <path
        className="theme-toggle__owl-eyelid theme-toggle__owl-eyelid--right"
        d="M16.95 16.55a3.35 3.35 0 0 1 6.7 0Z"
        fill="var(--theme-owl-lid)"
      />
      <path
        d="m16 18.2-1.35 1.8H16v1h1.35L16 18.2Z"
        fill="var(--theme-owl-beak)"
      />
      <path
        d="M13.2 24.35c.72.42 1.65.65 2.8.65s2.08-.23 2.8-.65"
        fill="none"
        stroke="var(--theme-owl-highlight)"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}

function ThemeTransitionOverlay({
  mode,
  origin,
  onComplete,
}: {
  mode: ThemeMode;
  origin: ThemeTransitionOrigin;
  onComplete: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(
      onComplete,
      mode === "dark"
        ? THEME_DARK_TRANSITION_DURATION_MS
        : THEME_LIGHT_TRANSITION_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [mode, onComplete]);

  const style: ThemeTransitionStyle = {
    "--theme-transition-origin-x": `${origin.x}px`,
    "--theme-transition-origin-y": `${origin.y}px`,
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "theme-transition-overlay",
        mode === "dark"
          ? "theme-transition-overlay--dark"
          : "theme-transition-overlay--light",
      )}
      style={style}
    >
      {mode === "dark"
        ? shootingStars.map((star) => (
            <span
              key={star.id}
              className="theme-shooting-star"
              data-shooting-star={star.id}
              style={star.style}
            />
          ))
        : null}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [transition, setTransition] = useState<ThemeMode | null>(null);
  const [transitionOrigin, setTransitionOrigin] =
    useState<ThemeTransitionOrigin>({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();
  const documentVisible = useDocumentVisible();
  const isDark = resolvedTheme === "dark";
  const completeTransition = useCallback(() => setTransition(null), []);

  useEffect(() => setMounted(true), []);

  const changeTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const nextTheme: ThemeMode = isDark ? "light" : "dark";
    const now = Date.now();
    setTransition(null);
    const canPlayTransition =
      !reducedMotion &&
      shouldPlayThemeTransition(
        now,
        window.localStorage.getItem(THEME_ANIMATION_STORAGE_KEY),
      );

    if (canPlayTransition) {
      const bounds = event.currentTarget.getBoundingClientRect();
      setTransitionOrigin({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
      window.localStorage.setItem(THEME_ANIMATION_STORAGE_KEY, String(now));
      setTransition(nextTheme);
    }

    setTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <button
        aria-label="Theme preference is loading"
        aria-checked={false}
        className="theme-toggle"
        disabled
        role="switch"
        type="button"
      />
    );
  }

  const actionLabel = `Switch to ${isDark ? "light" : "dark"} mode`;

  return (
    <>
      <button
        aria-checked={isDark}
        aria-label={actionLabel}
        className="theme-toggle"
        data-theme={isDark ? "dark" : "light"}
        onClick={changeTheme}
        role="switch"
        type="button"
      >
        <span className="theme-toggle__track" aria-hidden="true">
          <span className="theme-toggle__thumb">
            {isDark ? (
              <DarkModeOwlIcon documentVisible={documentVisible} />
            ) : (
              <Sun className="theme-toggle__sun size-5" />
            )}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="theme-toggle__tooltip rounded-[var(--radius-control)] border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-[var(--shadow-card)]"
        >
          {actionLabel}
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {isDark ? "Dark mode enabled" : "Light mode enabled"}
      </span>
      {transition ? (
        <ThemeTransitionOverlay
          mode={transition}
          origin={transitionOrigin}
          onComplete={completeTransition}
        />
      ) : null}
    </>
  );
}
