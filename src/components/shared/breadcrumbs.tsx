import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { breadcrumbsFor } from "@/lib/breadcrumbs";
import type { Role, Workspace } from "@/types/domain";

export function Breadcrumbs({
  pathname,
  workspace,
  role,
}: {
  pathname: string;
  workspace: Workspace;
  role: Role;
}) {
  const items = breadcrumbsFor({ pathname, workspace, role });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            {index ? (
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            {item.current ? (
              <span
                className="truncate font-medium text-foreground"
                aria-current="page"
                title={item.label}
              >
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                className="truncate hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={item.href}
                title={item.label}
              >
                {item.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
