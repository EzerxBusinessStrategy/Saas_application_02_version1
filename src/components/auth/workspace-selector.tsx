"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Building2,
  ChevronRight,
  LoaderCircle,
  Shield,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResolvedWorkspace } from "@/lib/workspace-resolver";
import { workspaceRoleLabel } from "@/lib/workspace-resolver";

type Props = {
  workspaces: ResolvedWorkspace[];
  displayName?: string;
};

const workspaceIcons: Record<string, typeof Building2> = {
  "super-admin": Shield,
  admin: Building2,
  manager: Users,
  employee: Users,
  client: Building2,
};

export function WorkspaceSelector({ workspaces, displayName }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelect = async (ws: ResolvedWorkspace) => {
    const key = ws.tenantId ?? ws.workspace;
    setSelecting(key);
    try {
      const response = await fetch("/api/auth/select-workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: ws.workspace,
          tenantId: ws.tenantId,
        }),
      });
      if (response.ok) {
        const { redirect } = (await response.json()) as { redirect: string };
        window.location.assign(redirect);
        return;
      }
      // Fallback: navigate directly
      window.location.assign(`/${ws.workspace}`);
    } catch {
      window.location.assign(`/${ws.workspace}`);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-muted">
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          <Image
            src="/branding/default-mark.svg"
            alt=""
            width={32}
            height={32}
            priority
          />
          <span className="text-lg font-bold tracking-tight">SaaS App</span>
        </div>

        <Card className="w-full rounded-2xl border-border/80 shadow-[var(--shadow-card)]">
          <CardHeader className="p-6 pb-2 sm:p-8 sm:pb-3">
            <CardTitle className="text-center text-2xl">
              Choose a workspace
            </CardTitle>
            {displayName ? (
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Welcome back, {displayName}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 pb-6 sm:px-8 sm:pb-8">
            {workspaces.map((ws) => {
              const Icon = workspaceIcons[ws.workspace] ?? Building2;
              const key = ws.tenantId ?? ws.workspace;
              const isSelecting = selecting === key;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={selecting !== null}
                  onClick={() => handleSelect(ws)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-foreground">
                      {ws.label}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {workspaceRoleLabel(ws)}
                    </span>
                  </span>
                  {isSelecting ? (
                    <LoaderCircle
                      className="size-4 shrink-0 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <footer className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Help</span>
          <span>System status</span>
        </footer>
      </main>
    </div>
  );
}
