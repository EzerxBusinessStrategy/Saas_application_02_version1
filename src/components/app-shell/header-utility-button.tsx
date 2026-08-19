import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export const headerUtilityButtonClassName =
  "relative inline-flex size-10 items-center justify-center rounded-[10px] border border-border/80 bg-background text-foreground shadow-none transition-[background-color,border-color,box-shadow,color] duration-200 hover:border-border hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function HeaderUtilityButton({
  className,
  children,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(headerUtilityButtonClassName, className)}
      {...props}
    >
      {children}
    </button>
  );
}
