"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { APP_VERSION } from "@/lib/app-version";
import {
  notesForSection,
  RELEASES,
  sectionLabel,
  type ReleaseNoteSection,
} from "@/lib/release-log";
import { cn } from "@/lib/utils";

const NOTE_SECTIONS: readonly ReleaseNoteSection[] = ["added", "improved", "fixed"];

export function WhatsNewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="What's new"
        description="Recent product updates for this workspace."
        className="flex max-h-[min(36rem,calc(100vh-2rem))] max-w-lg flex-col overflow-hidden p-0"
      >
        <div className="border-b px-6 py-4 pr-12">
          <h2 className="text-lg font-semibold">What&apos;s new</h2>
          <p className="mt-1 text-sm text-muted-foreground">Product updates in this release.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 pr-8">
          <ol className="grid gap-6">
            {RELEASES.map((release, index) => (
              <li key={release.version} className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">v{release.version}</p>
                  {index === 0 ? <Badge tone="info">Latest</Badge> : null}
                  <p className="text-xs text-muted-foreground">{release.date}</p>
                </div>
                <p className="text-sm font-medium">{release.title}</p>
                {NOTE_SECTIONS.map((section) => {
                  const notes = notesForSection(release, section);
                  if (!notes.length) return null;
                  return (
                    <div key={section} className="grid gap-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {sectionLabel(section)}
                      </p>
                      <ul className="grid gap-1.5">
                        {notes.map((note) => (
                          <li key={note} className="text-sm text-foreground">
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </li>
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SidebarWhatsNewButton({
  collapsed,
  onOpen,
}: {
  collapsed: boolean;
  onOpen: () => void;
}) {
  const label = `v${APP_VERSION} · What's new`;
  return (
    <div className={cn("mt-auto border-t border-sidebar-foreground/10", collapsed ? "px-1 py-2" : "px-3 py-3")}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "group relative h-11 min-h-11 w-full gap-2 rounded-[var(--radius-control)] px-[15px] text-sm font-normal leading-5 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground focus-visible:ring-white",
          collapsed ? "justify-center px-2" : "justify-start px-3",
        )}
        aria-label={label}
        title={collapsed ? label : undefined}
        onClick={onOpen}
      >
        <History className="size-[18px] shrink-0" aria-hidden="true" />
        <span
          aria-hidden={collapsed}
          className={cn(
            "min-w-0 flex-1 truncate text-left transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            collapsed
              ? "pointer-events-none absolute -translate-x-1 opacity-0"
              : "translate-x-0 opacity-100",
          )}
        >
          {label}
        </span>
        {collapsed ? (
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute left-[calc(100%+8px)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-foreground px-2 py-1 text-xs text-card opacity-0 shadow-sm transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 motion-reduce:transition-none"
          >
            {label}
          </span>
        ) : null}
      </Button>
    </div>
  );
}
