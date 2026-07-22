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
        "inline-flex items-center rounded-[var(--radius-control)] px-[7px] py-px text-xs font-medium leading-[18px]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
