"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SetupItem = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  destination: string | null;
};

type OrganisationSetupFloatProps = {
  organisationSetup: {
    completed: number;
    total: number;
    completionPercent: number;
    items: SetupItem[];
  };
};

export function OrganisationSetupFloat({ organisationSetup }: OrganisationSetupFloatProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const setupComplete = organisationSetup.completed === organisationSetup.total;

  if (setupComplete || dismissed) return null;

  const pendingItems = organisationSetup.items.filter((item) => !item.completed);

  return (
    <div className="fixed right-4 top-24 z-40 w-[min(100vw-2rem,22rem)] rounded-[var(--radius-card)] border border-primary/20 bg-card shadow-lg">
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Organisation setup</p>
          <p className="text-xs text-muted-foreground">
            {organisationSetup.completed} of {organisationSetup.total} completed
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            aria-label={expanded ? "Collapse setup checklist" : "Expand setup checklist"}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            aria-label="Dismiss setup reminder"
            onClick={() => setDismissed(true)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={organisationSetup.completionPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${organisationSetup.completionPercent}%` }} />
        </div>
        {expanded ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {organisationSetup.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    item.completed ? "bg-emerald-500" : "bg-amber-400",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  {item.destination && !item.completed ? (
                    <Link href={item.destination} className="font-medium text-primary hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <p className="font-medium">{item.label}</p>
                  )}
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {pendingItems.length
              ? `${pendingItems.length} setup step${pendingItems.length === 1 ? "" : "s"} still pending.`
              : "Finish the remaining setup steps to unlock full delivery."}
          </p>
        )}
      </div>
    </div>
  );
}
