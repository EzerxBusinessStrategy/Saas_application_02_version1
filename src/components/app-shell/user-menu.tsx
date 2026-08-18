"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "@/types/domain";

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
  workspace,
  open,
}: {
  workspace: Workspace;
  open?: boolean;
}) {
  const [profile, setProfile] = useState<AuthenticatedProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
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
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProfile(false);
      });
    return () => controller.abort();
  }, [portal]);

  const identity = useMemo(() => {
    const name = profile?.user.displayName || "Account";
    const roles = profile?.roles ?? [];
    const role = roleForPortal(roles, portal);
    return {
      name,
      email: profile?.user.email || "",
      initials: initialsFor(name),
      role: roleLabels[role] ?? role.replaceAll("_", " "),
    };
  }, [portal, profile]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch(`/api/auth/${portal}/logout`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setSignOutError(
          typeof payload?.message === "string"
            ? payload.message
            : "Sign out could not be completed. Please try again.",
        );
        return;
      }
      window.location.assign("/login");
    } finally {
      setSigningOut(false);
    }
  };

  if (loadingProfile) {
    return <UserMenuSkeleton />;
  }

  const accountHref = accountHrefByWorkspace[workspace];

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex h-12 min-w-[52px] max-w-[11.875rem] items-center gap-2.5 rounded-xl border border-border/80 bg-background px-2.5 text-left shadow-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-border hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Open user menu for ${identity.name}`}
          title={`Open user menu for ${identity.name}`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {identity.initials}
          </span>
          <span
            className="hidden min-w-0 flex-1 truncate text-sm font-medium text-foreground sm:block"
            title={identity.name}
          >
            {identity.name}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="px-2 py-2">
          <DropdownMenuLabel className="truncate p-0 text-sm font-semibold text-foreground" title={identity.name}>
            {identity.name}
          </DropdownMenuLabel>
          <p className="text-xs text-muted-foreground">{identity.role}</p>
          {identity.email ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={identity.email}>
              {identity.email}
            </p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={accountHref}>
            <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={accountHref}>
            <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
            Account settings
          </Link>
        </DropdownMenuItem>
        {workspace === "admin" ? (
          <DropdownMenuItem asChild>
            <Link href={accountHref}>
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
              Tenant settings
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span>{signingOut ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
        {signOutError ? <p className="px-2 pb-1 text-xs text-destructive">{signOutError}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenuSkeleton() {
  return (
    <div
      className="flex h-12 min-w-[52px] max-w-[11.875rem] items-center gap-2.5 rounded-xl border border-border/80 bg-background px-2.5"
      aria-label="Loading account profile"
      role="status"
    >
      <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
      <span className="hidden h-4 w-24 animate-pulse rounded bg-muted sm:block" />
      <span className="size-4 shrink-0" aria-hidden="true" />
    </div>
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

function roleForPortal(roles: readonly string[], portal: PortalKey): string {
  const preference: Record<PortalKey, readonly string[]> = {
    "super-admin": ["SUPER_ADMIN"],
    tenant: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"],
    employee: ["MANAGER", "EMPLOYEE"],
    client: ["CLIENT_USER"],
  };
  return preference[portal].find((role) => roles.includes(role)) ?? roles[0] ?? defaultRoleForPortal(portal);
}

function defaultRoleForPortal(portal: PortalKey): string {
  return {
    "super-admin": "SUPER_ADMIN",
    tenant: "TENANT_ADMIN",
    employee: "EMPLOYEE",
    client: "CLIENT_USER",
  }[portal];
}
