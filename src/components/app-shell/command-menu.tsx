"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { flattenNavigation, navigationFor } from "@/lib/nav";
import { hasAnyPermission } from "@/lib/permissions";
import type { Role, Workspace } from "@/types/domain";

export function CommandMenu({
  open,
  onOpenChange,
  workspace,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  role: Role;
}) {
  const [query, setQuery] = useState("");
  const commands = useMemo(
    () =>
      flattenNavigation(navigationFor(workspace))
        .filter((item) => item.href !== undefined)
        .filter((item) => hasAnyPermission(role, item.permissions))
        .map((item) => ({
          label: item.label,
          href: `/${workspace}${item.href ?? ""}`,
          Icon: item.icon,
        })),
    [role, workspace],
  );
  const matches = commands.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Navigate workspace"
        description="Search available workspace navigation."
        className="top-20 max-h-[calc(100dvh-6rem)] -translate-y-0 overflow-y-auto sm:top-1/2 sm:-translate-y-1/2"
      >
        <div className="pr-8">
          <h2 className="font-semibold">Navigate workspace</h2>
          <label className="relative mt-4 block">
            <span className="sr-only">Search navigation</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages"
              className="pl-9"
            />
          </label>
          <div className="mt-4">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Navigation
            </p>
            {matches.length ? (
              <ul
                className="mt-2 flex flex-col gap-1"
                aria-label="Navigation results"
              >
                {matches.map(({ label, href, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onOpenChange(false)}
                    >
                      {Icon ? (
                        <Icon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-[var(--radius-control)] bg-muted px-3 py-4 text-sm text-muted-foreground">
                No available pages match “{query}”.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
