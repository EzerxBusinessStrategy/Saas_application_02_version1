"use client";

import { useEffect, useState } from "react";
import { Building2, Search } from "lucide-react";
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
import { searchSuperAdminRecords } from "@/features/platform/api/super-admin-search-api";
import type { TenantContext } from "@/types/app-shell";

export type TenantSwitcherState = "ready" | "loading" | "empty" | "disabled";

const platformContext: TenantContext = {
  id: "platform",
  name: "Platform context",
  status: "active",
};

export function TenantSwitcher({
  currentTenant = platformContext,
  tenants,
  state = "ready",
}: {
  currentTenant?: TenantContext;
  tenants?: TenantContext[];
  state?: TenantSwitcherState;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loadedTenants, setLoadedTenants] = useState<TenantContext[]>(tenants ?? []);
  const [remoteState, setRemoteState] = useState<TenantSwitcherState>("loading");
  const disabled = state === "disabled";
  const effectiveState = tenants ? state : remoteState;
  const results = tenants ?? loadedTenants;
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (tenants || !open || disabled) return;
    if (trimmedQuery.length === 1) {
      setLoadedTenants([]);
      setRemoteState("empty");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRemoteState("loading");
      searchSuperAdminRecords({ query: trimmedQuery, limit: 10, scope: "tenants" }, controller.signal)
        .then((response) => {
          const nextTenants = response.results
            .filter((result) => result.type === "tenant")
            .map((result) => ({
              id: result.id,
              name: result.title,
              status: result.status,
            }));
          setLoadedTenants(nextTenants);
          setRemoteState(nextTenants.length ? "ready" : "empty");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setLoadedTenants([]);
          setRemoteState("empty");
        });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, open, tenants, trimmedQuery]);

  return (
    <DropdownMenu
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
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
          <span className="hidden truncate sm:inline">{currentTenant.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">Tenant context</DropdownMenuLabel>
          <p className="mt-1 text-xs text-muted-foreground">Support access is controlled and audited.</p>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
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
        {effectiveState === "loading" ? (
          <p className="px-3 py-5 text-sm text-muted-foreground">Loading tenants...</p>
        ) : null}
        {effectiveState === "empty" ? (
          <p className="px-3 py-5 text-sm text-muted-foreground">
            {trimmedQuery.length === 1 ? "Type at least 2 characters." : "No tenant contexts are available."}
          </p>
        ) : null}
        {effectiveState === "ready" ? (
          <div className="max-h-72 overflow-y-auto p-1">
            <DropdownMenuItem className="flex-col items-start gap-0 whitespace-normal" disabled>
              <span className="max-w-full truncate font-medium">{platformContext.name}</span>
              <span className="text-xs text-muted-foreground">{platformContext.status}</span>
            </DropdownMenuItem>
            {results.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                className="flex-col items-start gap-0 whitespace-normal"
                disabled
              >
                <span className="max-w-full truncate font-medium" title={tenant.name}>
                  {tenant.name}
                </span>
                <span className="text-xs text-muted-foreground">{tenant.status}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ) : null}
        <p className="border-t px-3 py-2 text-xs text-muted-foreground" role="status">
          Tenant context changes require a controlled support session.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
