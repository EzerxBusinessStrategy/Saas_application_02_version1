"use client";

import { useEffect, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { usePathname } from "next/navigation";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : "GET";
}

export function PendingActionIndicator({ suppressed = false }: { suppressed?: boolean }) {
  const pathname = usePathname();
  const queryMutations = useIsMutating();
  const [fetchMutations, setFetchMutations] = useState(0);
  const [navigationPending, setNavigationPending] = useState(false);
  const pending = queryMutations > 0 || fetchMutations > 0 || navigationPending;

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const isMutation = mutationMethods.has(requestMethod(input, init));
      if (isMutation) setFetchMutations((count) => count + 1);
      try {
        return await originalFetch(input, init);
      } finally {
        if (isMutation) setFetchMutations((count) => Math.max(0, count - 1));
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const beginNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      if (link.dataset.suppressSharedPending === "true") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === pathname) return;
      setNavigationPending(true);
    };
    document.addEventListener("click", beginNavigation, true);
    return () => document.removeEventListener("click", beginNavigation, true);
  }, [pathname]);

  useEffect(() => {
    setNavigationPending(false);
  }, [pathname]);

  if (!pending || suppressed) return null;

  const label = navigationPending && queryMutations === 0 && fetchMutations === 0
    ? "Loading workspace"
    : "Saving changes";

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-card)]"
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
