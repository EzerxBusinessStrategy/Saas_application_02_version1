"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Search, UserRound, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchSuperAdminRecords } from "@/features/platform/api/super-admin-search-api";
import { flattenNavigation, navigationFor } from "@/lib/nav";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Role, Workspace } from "@/types/domain";
import type { SuperAdminSearchResult } from "@/types/super-admin-search";

type LocalCommand = {
  label: string;
  href: string;
  Icon?: LucideIcon;
};

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuperAdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const remoteSearch = workspace === "super-admin" && role === "SUPER_ADMIN";
  const trimmedQuery = query.trim();
  const commands = useLocalCommands(workspace, role);
  const localMatches = commands.filter((command) =>
    command.label.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!remoteSearch || !open) return;
    if (trimmedQuery.length === 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchSuperAdminRecords({ query: trimmedQuery, limit: 12 }, controller.signal)
        .then((response) => {
          setResults(response.results);
          setActiveIndex(0);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setLoading(false);
        });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, remoteSearch, trimmedQuery]);

  const openResult = (result: SuperAdminSearchResult) => {
    router.push(result.href);
    onOpenChange(false);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!remoteSearch) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openResult(results[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={remoteSearch ? "Search platform" : "Navigate workspace"}
        description={remoteSearch ? "Search tenants and users." : "Search available workspace navigation."}
        className="top-20 max-h-[calc(100dvh-6rem)] -translate-y-0 overflow-y-auto sm:top-1/2 sm:-translate-y-1/2"
      >
        <div className="pr-8">
          <h2 className="font-semibold">{remoteSearch ? "Search platform" : "Navigate workspace"}</h2>
          <label className="relative mt-4 block">
            <span className="sr-only">{remoteSearch ? "Search platform" : "Search navigation"}</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={remoteSearch ? "Search tenants, users, email or code" : "Search pages"}
              className="pl-9"
            />
          </label>
          {remoteSearch ? (
            <RemoteResults
              query={trimmedQuery}
              results={results}
              loading={loading}
              activeIndex={activeIndex}
              onOpen={openResult}
            />
          ) : (
            <LocalResults matches={localMatches} query={trimmedQuery} onOpenChange={onOpenChange} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useLocalCommands(workspace: Workspace, role: Role): LocalCommand[] {
  return useMemo(
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
}

function LocalResults({
  matches,
  query,
  onOpenChange,
}: {
  matches: LocalCommand[];
  query: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="mt-4">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Navigation</p>
      {matches.length ? (
        <ul className="mt-2 flex flex-col gap-1" aria-label="Navigation results">
          {matches.map(({ label, href, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onOpenChange(false)}
              >
                {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
                <span className="truncate">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-[var(--radius-control)] bg-muted px-3 py-4 text-sm text-muted-foreground">
          No available pages match "{query}".
        </p>
      )}
    </div>
  );
}

function RemoteResults({
  query,
  results,
  loading,
  activeIndex,
  onOpen,
}: {
  query: string;
  results: SuperAdminSearchResult[];
  loading: boolean;
  activeIndex: number;
  onOpen: (result: SuperAdminSearchResult) => void;
}) {
  if (query.length === 1) {
    return <p className="mt-3 rounded-[var(--radius-control)] bg-muted px-3 py-4 text-sm text-muted-foreground">Type at least 2 characters.</p>;
  }

  const tenants = results.filter((result) => result.type === "tenant");
  const users = results.filter((result) => result.type === "user");

  return (
    <div className="mt-4">
      {loading ? <p className="px-1 py-3 text-sm text-muted-foreground">Searching...</p> : null}
      {!loading && !results.length ? (
        <p className="rounded-[var(--radius-control)] bg-muted px-3 py-4 text-sm text-muted-foreground">
          {query ? `No records match "${query}".` : "Recent platform records will appear here."}
        </p>
      ) : null}
      <ResultGroup title="Tenants" results={tenants} allResults={results} activeIndex={activeIndex} onOpen={onOpen} />
      <ResultGroup title="Users" results={users} allResults={results} activeIndex={activeIndex} onOpen={onOpen} />
    </div>
  );
}

function ResultGroup({
  title,
  results,
  allResults,
  activeIndex,
  onOpen,
}: {
  title: string;
  results: SuperAdminSearchResult[];
  allResults: SuperAdminSearchResult[];
  activeIndex: number;
  onOpen: (result: SuperAdminSearchResult) => void;
}) {
  if (!results.length) return null;

  return (
    <section className="mt-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {results.map((result) => {
          const index = allResults.findIndex((item) => item.id === result.id && item.type === result.type);
          const Icon = result.type === "tenant" ? Building2 : UserRound;
          return (
            <li key={`${result.type}-${result.id}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  index === activeIndex && "bg-muted",
                )}
                onClick={() => onOpen(result)}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[result.code, result.subtitle, result.status].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
