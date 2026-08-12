"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
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
          className="group flex h-12 min-w-0 max-w-[min(18rem,45vw)] items-center gap-2 rounded-l-full rounded-r-[var(--radius-control)] border border-border/80 bg-card py-1 pl-1 pr-1.5 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-[0_4px_12px_rgb(28_36_52/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary/55 data-[state=open]:bg-primary/[0.06] sm:max-w-64"
          aria-label={`Open user menu for ${user.name}`}
          title={`Open user menu for ${user.name}`}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[1rem_0.55rem_1rem_0.55rem] bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/15 transition-transform group-hover:rotate-[-3deg] group-data-[state=open]:rotate-3deg motion-reduce:transition-none">
            {user.initials}
          </span>
          <span className="hidden min-w-0 flex-1 text-sm sm:block">
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
          <ChevronDown
            className="size-4 shrink-0 rounded-full bg-muted/80 p-1 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
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
