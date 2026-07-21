"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { tenantContexts } from "@/mocks/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TenantContext } from "@/types/app-shell";

export type TenantSwitcherState = "ready" | "loading" | "empty" | "disabled";

export function TenantSwitcher({
  currentTenant = tenantContexts[0],
  tenants = tenantContexts,
  state = "ready",
}: {
  currentTenant?: TenantContext;
  tenants?: TenantContext[];
  state?: TenantSwitcherState;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      tenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, tenants],
  );
  const disabled = state === "disabled";

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="size-10 justify-center p-0 sm:max-w-48 sm:justify-start sm:px-2"
          aria-label={`Tenant context: ${currentTenant.name}`}
          title={currentTenant.name}
        >
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden truncate sm:inline">
            {currentTenant.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        <div className="px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">
            Tenant context
          </DropdownMenuLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            Support access is controlled and audited.
          </p>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {tenants.length > 8 ? (
          <label className="relative m-2 block">
            <span className="sr-only">Search tenants</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search tenants"
            />
          </label>
        ) : null}
        {state === "loading" ? (
          <p className="px-3 py-5 text-sm text-muted-foreground">
            Loading tenants…
          </p>
        ) : null}
        {state === "empty" ? (
          <p className="px-3 py-5 text-sm text-muted-foreground">
            No tenant contexts are available.
          </p>
        ) : null}
        {state === "ready" ? (
          <div className="max-h-72 overflow-y-auto p-1">
            {results.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                className="flex-col items-start gap-0 whitespace-normal"
                disabled
              >
                <span
                  className="max-w-full truncate font-medium"
                  title={tenant.name}
                >
                  {tenant.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tenant.status}
                </span>
              </DropdownMenuItem>
            ))}
            {!results.length ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No tenants match that search.
              </p>
            ) : null}
          </div>
        ) : null}
        <p
          className="border-t px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          Tenant context changes require a controlled support session.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
