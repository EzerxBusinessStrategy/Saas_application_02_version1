import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const tones = {
  neutral: "bg-[var(--chip-neutral-bg)] text-muted-foreground",
  success: "bg-[var(--chip-success-bg)] text-success",
  warning: "bg-[var(--chip-warning-bg)] text-warning",
  danger: "bg-[var(--chip-danger-bg)] text-danger",
  info: "bg-accent text-accent-foreground",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 shrink-0 align-middle items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
