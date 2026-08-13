"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User, Workspace } from "@/types/domain";

type PortalKey = "super-admin" | "tenant" | "employee" | "client";

type AuthenticatedProfile = {
  readonly user: {
    readonly displayName: string;
    readonly email: string;
  };
  readonly roles: readonly string[];
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_OWNER: "Tenant Owner",
  TENANT_ADMIN: "Tenant Admin",
  FINANCE_USER: "Finance User",
  HR_OPERATIONS_USER: "HR Operations User",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  CLIENT_USER: "Client",
};

const portalForWorkspace: Record<Workspace, PortalKey> = {
  "super-admin": "super-admin",
  admin: "tenant",
  manager: "employee",
  employee: "employee",
  client: "client",
};

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
  const [profile, setProfile] = useState<AuthenticatedProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const portal = portalForWorkspace[workspace];

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/me?portal=${portal}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AuthenticatedProfile;
      })
      .then((response) => {
        if (response) setProfile(response);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [portal]);

  const identity = useMemo(() => {
    const name = profile?.user.displayName || user.name;
    const roles = profile?.roles ?? user.roles ?? [user.role];
    const role = roleForPortal(roles, portal, user.role);
    return {
      name,
      email: profile?.user.email || user.email,
      initials: initialsFor(name),
      role: roleLabels[role] ?? role.replaceAll("_", " "),
    };
  }, [portal, profile, user.email, user.name, user.role, user.roles]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch(`/api/auth/${portal}/logout`, { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex h-[58px] min-w-[52px] max-w-[min(18rem,48vw)] items-center gap-3 rounded-[18px] border border-violet-100/80 bg-gradient-to-r from-[#eef2ff] via-[#f8f7ff] to-[#fff2f6] px-2.5 text-left shadow-[0_4px_18px_rgb(30_41_59/0.06)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-violet-200 hover:shadow-[0_8px_28px_rgb(76_29_149/0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 motion-reduce:transform-none"
          aria-label={`Open user menu for ${identity.name}`}
          title={`Open user menu for ${identity.name}`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white shadow-[0_4px_12px_rgb(99_102_241/0.25)]">
            {identity.initials}
          </span>
          <span className="hidden min-w-0 flex-1 sm:block">
            <span
              className="block truncate text-[13px] font-semibold leading-5 text-slate-900"
              title={identity.name}
            >
              {identity.name}
            </span>
            <span className="block truncate text-[11px] font-medium text-slate-500">
              {identity.role}
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-slate-600 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="relative w-60 overflow-visible rounded-[14px] border-slate-200/80 bg-white p-2 shadow-[0_18px_50px_rgb(15_23_42/0.14)] data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
      >
        <span className="absolute -top-[6px] right-7 size-3 rotate-45 border-l border-t border-slate-200/80 bg-white" aria-hidden="true" />
        <span className="absolute left-3 right-3 top-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400" aria-hidden="true" />
        <div className="flex items-center gap-3 px-2.5 pb-3 pt-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white shadow-sm">
            {identity.initials}
          </span>
          <div className="min-w-0">
            <DropdownMenuLabel className="truncate p-0 text-[13px] font-semibold text-slate-900" title={identity.name}>
              {identity.name}
            </DropdownMenuLabel>
            <p className="text-[11px] font-medium text-slate-500">{identity.role}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400" title={identity.email}>{identity.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-slate-100" />
        <DropdownMenuItem asChild className="group/item gap-2.5 rounded-lg px-2.5 py-2.5 text-[12px] font-medium text-slate-700 data-[highlighted]:bg-violet-50/70 data-[highlighted]:text-slate-900">
          <Link href={accountHrefByWorkspace[workspace]}>
            <UserRound className="size-[15px] text-slate-500" aria-hidden="true" />
            <span className="flex-1">Profile and preferences</span>
            <ChevronRight className="size-3.5 text-slate-400 transition-transform group-hover/item:translate-x-0.5" aria-hidden="true" />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-slate-100" />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          className="mt-1 gap-2.5 rounded-lg px-2.5 py-2.5 text-[12px] font-medium text-red-500 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-600"
        >
            <LogOut className="size-[15px]" aria-hidden="true" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function roleForPortal(roles: readonly string[], portal: PortalKey, fallback: User["role"]): string {
  const preference: Record<PortalKey, readonly string[]> = {
    "super-admin": ["SUPER_ADMIN"],
    tenant: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"],
    employee: ["MANAGER", "EMPLOYEE"],
    client: ["CLIENT_USER"],
  };
  return preference[portal].find((role) => roles.includes(role)) ?? roles[0] ?? fallback;
}
