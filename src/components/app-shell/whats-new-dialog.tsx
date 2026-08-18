"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  History,
  PlusCircle,
  Search,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { APP_VERSION } from "@/lib/app-version";
import {
  LATEST_RELEASE,
  notesForSection,
  RELEASES,
  sectionCount,
  sectionLabel,
  type Release,
  type ReleaseChangeItem,
  type ReleaseNoteSection,
} from "@/lib/release-log";
import { readSeenReleaseVersion, writeSeenReleaseVersion } from "@/lib/whats-new-seen";
import { cn } from "@/lib/utils";

const NOTE_SECTIONS: readonly ReleaseNoteSection[] = ["added", "improved", "fixed"];
const FILTERS = ["all", ...NOTE_SECTIONS] as const;
type ReleaseFilter = (typeof FILTERS)[number];

export function useWhatsNewUnseen(open: boolean): boolean {
  const [seenVersion, setSeenVersion] = useState<string | null>(APP_VERSION);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSeenVersion(readSeenReleaseVersion());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    writeSeenReleaseVersion(APP_VERSION);
    setSeenVersion(APP_VERSION);
  }, [open]);

  return ready && seenVersion !== APP_VERSION;
}

export function WhatsNewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReleaseFilter>("all");
  const [expanded, setExpanded] = useState<ReadonlySet<ReleaseNoteSection>>(
    () => new Set(NOTE_SECTIONS),
  );

  useEffect(() => {
    if (open) return;
    setQuery("");
    setFilter("all");
    setExpanded(new Set(NOTE_SECTIONS));
  }, [open]);

  const release = LATEST_RELEASE;
  const search = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () =>
      NOTE_SECTIONS.filter((section) => filter === "all" || filter === section)
        .map((section) => ({
          section,
          items: notesForSection(release, section).filter((item) => matchesQuery(item, search)),
        }))
        .filter((entry) => entry.items.length > 0),
    [filter, release, search],
  );

  const copyVersion = async () => {
    try {
      await navigator.clipboard.writeText(`v${release.version}`);
      toast.success("Version copied");
    } catch {
      toast.error("Version could not be copied.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="What's new"
        description="Track product updates and release improvements."
        className="left-auto right-0 top-0 flex h-dvh max-h-none w-full max-w-md translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover px-5 py-4 pr-12">
          <h2 className="text-lg font-semibold tracking-tight">What&apos;s new</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track product updates and release improvements.
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Search updates</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search updates..."
                className="pl-9"
              />
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter updates">
            {FILTERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {filterLabel(value)}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ReleaseSummaryCard release={release} onCopyVersion={() => void copyVersion()} />

          {visibleSections.length ? (
            <div className="mt-4 grid gap-2">
              {visibleSections.map(({ section, items }) => (
                <ReleaseSection
                  key={section}
                  section={section}
                  items={items}
                  expanded={expanded.has(section)}
                  onToggle={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(section)) next.delete(section);
                      else next.add(section);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-[var(--radius-control)] border bg-card px-3 py-4 text-sm text-muted-foreground">
              No updates match this search.
            </p>
          )}

          <section id="whats-new-history" className="mt-6 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Release history
            </p>
            <ol className="mt-3 grid gap-3">
              {RELEASES.map((item, index) => (
                <li key={item.version} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1 size-2.5 shrink-0 rounded-full",
                      index === 0 ? "bg-primary" : "border border-border bg-background",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      v{item.version}
                      {index === 0 ? <Badge tone="info">Latest</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.date}</p>
                    <p className="mt-1 text-sm">{item.title}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="border-t bg-popover px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() =>
              document.getElementById("whats-new-history")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            View full changelog
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SidebarWhatsNewButton({
  collapsed,
  active = false,
  unseen = false,
  onOpen,
}: {
  collapsed: boolean;
  active?: boolean;
  unseen?: boolean;
  onOpen: () => void;
}) {
  const label = `v${APP_VERSION}`;
  const tooltip = `${label}\nWhat's new\n${LATEST_RELEASE.title}`;

  return (
    <div className={cn("mt-auto border-t border-sidebar-foreground/10", collapsed ? "px-1 py-2" : "px-3 py-3")}>
      <Button
        type="button"
        variant="ghost"
        aria-label={`${label}. ${LATEST_RELEASE.title}${unseen ? ". New release" : ""}`}
        title={collapsed ? tooltip : undefined}
        className={cn(
          "group relative h-auto min-h-11 w-full rounded-[var(--radius-control)] border border-transparent text-sidebar-foreground hover:border-sidebar-foreground/20 hover:bg-sidebar-active hover:text-sidebar-foreground hover:shadow-sm focus-visible:ring-white",
          collapsed ? "justify-center px-2 py-2" : "items-start justify-start px-3 py-2.5",
          active && "border-sidebar-foreground/25 bg-sidebar-active",
        )}
        onClick={onOpen}
      >
        {collapsed ? (
          <>
            <span className="relative">
              <History className="size-[18px]" aria-hidden="true" />
              {unseen ? <UnreadDot className="absolute -right-0.5 -top-0.5" /> : null}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute left-[calc(100%+8px)] top-1/2 z-20 w-44 -translate-y-1/2 rounded-[var(--radius-control)] bg-foreground px-2 py-1.5 text-left text-xs leading-4 text-card opacity-0 shadow-sm transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 motion-reduce:transition-none"
            >
              <span className="block font-medium">{label}</span>
              <span className="mt-0.5 block text-card/80">What&apos;s new</span>
              <span className="mt-0.5 block text-card/80">{LATEST_RELEASE.title}</span>
            </span>
          </>
        ) : (
          <span className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
                {unseen ? <UnreadDot /> : null}
                Current release
              </span>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="truncate text-sm font-semibold">{label}</span>
                <ArrowRight
                  className="size-3.5 shrink-0 text-sidebar-muted transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-0.5 block truncate text-xs text-sidebar-muted">
                {LATEST_RELEASE.title}
              </span>
            </span>
          </span>
        )}
      </Button>
    </div>
  );
}

function ReleaseSummaryCard({
  release,
  onCopyVersion,
}: {
  release: Release;
  onCopyVersion: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-control)] border bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">v{release.version}</p>
        <Badge tone="info">Latest</Badge>
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 px-2" onClick={onCopyVersion}>
          <Copy className="size-3.5" aria-hidden="true" />
          Copy
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {release.date} · Last updated {release.date}
      </p>
      <p className="mt-2 text-sm font-medium">{release.title}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {sectionCount(release, "added")} Added · {sectionCount(release, "improved")} Improved ·{" "}
        {sectionCount(release, "fixed")} Fixed
      </p>
    </section>
  );
}

function ReleaseSection({
  section,
  items,
  expanded,
  onToggle,
}: {
  section: ReleaseNoteSection;
  items: readonly ReleaseChangeItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = sectionIcon(section);
  return (
    <section className="rounded-[var(--radius-control)] border bg-card">
      <button
        type="button"
        className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {sectionLabel(section)}
        </span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {expanded ? (
        <ul className="grid gap-px border-t">
          {items.map((item) => (
            <li key={item.title}>
              <article className="grid gap-1 px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium leading-5">{item.title}</h3>
                  <Badge tone={item.tag === "Improved" ? "warning" : "info"}>{item.tag}</Badge>
                </div>
                <p className="text-xs leading-4 text-muted-foreground">{item.description}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-2 rounded-full bg-primary ring-2 ring-sidebar", className)}
      aria-hidden="true"
    />
  );
}

function matchesQuery(item: ReleaseChangeItem, search: string): boolean {
  if (!search) return true;
  return `${item.title} ${item.description}`.toLowerCase().includes(search);
}

function filterLabel(filter: ReleaseFilter): string {
  switch (filter) {
    case "all":
      return "All";
    case "added":
    case "improved":
    case "fixed":
      return sectionLabel(filter);
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

function sectionIcon(section: ReleaseNoteSection) {
  switch (section) {
    case "added":
      return PlusCircle;
    case "improved":
      return TrendingUp;
    case "fixed":
      return Wrench;
    default: {
      const _exhaustive: never = section;
      void _exhaustive;
      return PlusCircle;
    }
  }
}
