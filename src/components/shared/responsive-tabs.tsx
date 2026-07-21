"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResponsiveTab = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function ResponsiveTabs({
  tabs,
  value,
  onValueChange,
  label,
  children,
}: {
  tabs: ResponsiveTab[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  children?: ReactNode;
}) {
  const id = useId();
  const selectedTabId = `${id}-${value}`;
  return (
    <div className="overflow-x-auto">
      <div
        role="tablist"
        aria-label={label}
        className="flex min-w-max gap-1 border-b"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            id={`${id}-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={value === tab.value}
            aria-controls={`${id}-panel`}
            disabled={tab.disabled}
            className={cn(
              "min-h-10 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              value === tab.value && "border-primary text-primary",
            )}
            onClick={() => onValueChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children ? (
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={selectedTabId}
          className="pt-5"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
