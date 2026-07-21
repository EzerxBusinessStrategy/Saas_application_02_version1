import { Inbox } from "lucide-react";
export function EmptyState({
  title = "Nothing here yet",
  description = "Try changing the filters or create a new record.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[var(--radius-card)] border border-dashed p-6 text-center">
      <div>
        <Inbox className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
