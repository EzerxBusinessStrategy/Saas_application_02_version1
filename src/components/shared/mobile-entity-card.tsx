import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type MobileEntityAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

export function MobileEntityCard({
  title,
  identifier,
  leading,
  status,
  priority,
  metadata,
  primaryAction,
  overflowActions = [],
}: {
  title: string;
  identifier?: string;
  leading?: ReactNode;
  status?: ReactNode;
  priority?: ReactNode;
  metadata: ReactNode;
  primaryAction?: ReactNode;
  overflowActions?: MobileEntityAction[];
}) {
  return (
    <article className="flex flex-col gap-4 border-b py-5 last:border-0">
      <div className="flex items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium" title={title}>
            {title}
          </h2>
          {identifier ? (
            <p
              className="truncate text-xs text-muted-foreground"
              title={identifier}
            >
              {identifier}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {priority}
          {status}
          {overflowActions.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Actions for ${title}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflowActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled}
                    onSelect={action.onSelect}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{metadata}</dl>
      {primaryAction ? (
        <div className="flex items-center justify-end">{primaryAction}</div>
      ) : null}
    </article>
  );
}
