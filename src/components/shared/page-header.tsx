import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  eyebrowIcon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrowIcon?: LucideIcon;
}) {
  const EyebrowIcon = eyebrowIcon;

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? (
          <p
            className={cn(
              "text-sm font-medium text-primary",
              EyebrowIcon &&
                "inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-control)] border border-primary/15 bg-primary/5 px-2 py-1 text-xs font-semibold",
            )}
            aria-label={EyebrowIcon ? `Page context: ${eyebrow}` : undefined}
          >
            {EyebrowIcon ? (
              <EyebrowIcon className="size-3.5" aria-hidden="true" />
            ) : null}
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[28px] leading-[34px] font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
