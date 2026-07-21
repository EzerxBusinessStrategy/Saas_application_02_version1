"use client";

import Link from "next/link";
import { Layers3 } from "lucide-react";
import { workspaceOptions } from "@/mocks/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { WorkspaceOption } from "@/types/app-shell";
import type { Workspace } from "@/types/domain";

export type WorkspaceSwitcherState = "ready" | "loading" | "empty" | "disabled";

export function WorkspaceSwitcher({
  currentWorkspace,
  availableWorkspaces = workspaceOptions.filter(
    (item) => item.value === currentWorkspace,
  ),
  state = "ready",
}: {
  currentWorkspace: Workspace;
  availableWorkspaces?: WorkspaceOption[];
  state?: WorkspaceSwitcherState;
}) {
  const current = workspaceOptions.find(
    (item) => item.value === currentWorkspace,
  ) ?? {
    value: currentWorkspace,
    label: currentWorkspace,
  };
  const disabled = state === "disabled" || availableWorkspaces.length <= 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="hidden max-w-44 justify-start lg:flex"
          title={current.label}
        >
          <Layers3 className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {state === "loading" ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Loading workspaces…
          </p>
        ) : null}
        {state === "empty" ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No workspaces are available.
          </p>
        ) : null}
        {state === "ready"
          ? availableWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.value}
                disabled={workspace.value === currentWorkspace}
                asChild
              >
                <Link href={`/${workspace.value}`}>{workspace.label}</Link>
              </DropdownMenuItem>
            ))
          : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
