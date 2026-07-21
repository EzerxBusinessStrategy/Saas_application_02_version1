import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";

export function EntityHeader({
  eyebrow,
  title,
  description,
  metadata,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />
      {metadata ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {metadata}
        </div>
      ) : null}
    </div>
  );
}
