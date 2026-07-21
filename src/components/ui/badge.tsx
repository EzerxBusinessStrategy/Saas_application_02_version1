import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const tones = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-primary/10 text-primary",
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
