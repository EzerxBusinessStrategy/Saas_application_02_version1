import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export const Card = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <section
    data-slot="card"
    className={cn(
      "rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]",
      className,
    )}
    {...props}
  />
);
export const CardHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 p-[30px]", className)} {...props} />
);
export const CardTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn("text-[22px] leading-7 font-bold tracking-tight", className)}
    {...props}
  />
);
export const CardDescription = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
export const CardContent = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-[30px] pb-[30px] pt-0", className)} {...props} />
);
