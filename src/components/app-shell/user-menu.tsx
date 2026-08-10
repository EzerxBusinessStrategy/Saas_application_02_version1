"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User, Workspace } from "@/types/domain";

const formatRole = (role: User["role"]) =>
  role.replaceAll("_", " ").toLowerCase();

const accountHrefByWorkspace: Record<Workspace, string> = {
  "super-admin": "/super-admin/account",
  admin: "/admin/settings",
  manager: "/employee/profile",
  employee: "/employee/profile",
  client: "/client/profile",
};

export function UserMenu({
  user,
  workspace,
  open,
}: {
  user: User;
  workspace: Workspace;
  open?: boolean;
}) {
  const signOut = async () => {
    await fetch("/api/demo-auth/logout", { method: "POST" });
    window.location.assign("/login");
  };

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open user menu"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {user.initials}
          </span>
          <span className="hidden min-w-0 text-sm sm:block">
            <span
              className="block truncate font-medium leading-5"
              title={user.name}
            >
              {user.name}
            </span>
            <span className="block truncate text-xs capitalize text-muted-foreground">
              {formatRole(user.role)}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-3 py-2">
          <DropdownMenuLabel
            className="truncate p-0 font-semibold"
            title={user.name}
          >
            {user.name}
          </DropdownMenuLabel>
          <p
            className="truncate text-xs text-muted-foreground"
            title={user.email}
          >
            {user.email}
          </p>
          <p className="mt-1 text-xs capitalize text-muted-foreground">
            {formatRole(user.role)}
          </p>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href={accountHrefByWorkspace[workspace]}>
            <UserRound className="size-4" aria-hidden="true" />
            Profile and preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
