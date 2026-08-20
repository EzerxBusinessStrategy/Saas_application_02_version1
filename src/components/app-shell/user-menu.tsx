"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  fetchCurrentUserContexts,
  switchWorkspace,
  useCurrentUser,
  type CurrentUserPortal,
  type WorkspaceContext,
} from "@/features/identity/api/current-user-api";
import type { Workspace } from "@/types/domain";

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

const portalForWorkspace: Record<Workspace, CurrentUserPortal> = {
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
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const portal = portalForWorkspace[workspace];
  const profileQuery = useCurrentUser(portal);
  const contextsQuery = useQuery({
    queryKey: ["me-contexts", portal],
    queryFn: () => fetchCurrentUserContexts(portal),
  });
  const profile = profileQuery.data;
  const contexts = contextsQuery.data ?? [];
  const loadingProfile = profileQuery.isPending;

  const identity = useMemo(() => {
    const name = profile?.user.displayName || "Account";
    const roles = profile?.roles ?? [];
    const role = roleForPortal(roles, portal);
    const title =
      contexts.find((context) => context.type === "tenant" && context.displayTitle)?.displayTitle ??
      (roleLabels[role] ?? role.replaceAll("_", " "));
    return {
      name,
      email: profile?.user.email || "",
      avatarUrl: profile?.user.avatarUrl,
      role: title,
    };
  }, [contexts, portal, profile]);

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

  const openWorkspace = async (input: { workspace: "super-admin" | "admin" | "employee"; tenantId?: string }) => {
    if (switching) return;
    setSwitching(true);
    try {
      const result = await switchWorkspace(portal, input);
      window.location.assign(result.redirect);
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "That workspace could not be opened.");
      setSwitching(false);
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
          <UserAvatar name={identity.name} src={identity.avatarUrl} size="md" />
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
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
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
        {contexts.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Switch workspace</p>
            <WorkspaceSwitcher
              contexts={contexts}
              currentWorkspace={workspace}
              disabled={switching}
              onSelect={(input) => void openWorkspace(input)}
            />
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={accountHref}>
            <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
            My profile
          </Link>
        </DropdownMenuItem>
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

function WorkspaceSwitcher({
  contexts,
  currentWorkspace,
  disabled,
  onSelect,
}: {
  contexts: readonly WorkspaceContext[];
  currentWorkspace: Workspace;
  disabled: boolean;
  onSelect: (input: { workspace: "super-admin" | "admin" | "employee"; tenantId?: string }) => void;
}) {
  const platform = contexts.find((context) => context.type === "platform");
  const tenants = contexts.filter((context) => context.type === "tenant");
  return (
    <div className="px-1 pb-1">
      {platform ? (
        <DropdownMenuItem
          disabled={disabled}
          onSelect={(event) => {
            event.preventDefault();
            onSelect({ workspace: "super-admin" });
          }}
        >
          {currentWorkspace === "super-admin" ? <Check className="size-4" aria-hidden="true" /> : <span className="size-4" />}
          Platform Admin
        </DropdownMenuItem>
      ) : null}
      {tenants.map((tenant) => {
        const canAdmin = tenant.roles.some((role) =>
          ["TENANT_ADMIN", "TENANT_OWNER", "FINANCE_USER", "HR_OPERATIONS_USER"].includes(role),
        );
        const canEmployee = tenant.roles.some((role) => role === "EMPLOYEE" || role === "MANAGER");
        const managerLabel = tenant.roles.includes("MANAGER") ? " · Manager" : "";
        return (
          <div key={tenant.tenantId} className="px-2 py-1">
            <p className="text-sm font-medium">{tenant.tenantName}</p>
            {canAdmin ? (
              <DropdownMenuItem
                disabled={disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  onSelect({ workspace: "admin", tenantId: tenant.tenantId });
                }}
              >
                Admin workspace
              </DropdownMenuItem>
            ) : null}
            {canEmployee ? (
              <DropdownMenuItem
                disabled={disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  onSelect({ workspace: "employee", tenantId: tenant.tenantId });
                }}
              >
                {`My workspace${managerLabel}`}
              </DropdownMenuItem>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function roleForPortal(roles: readonly string[], portal: CurrentUserPortal): string {
  const preference: Record<CurrentUserPortal, readonly string[]> = {
    "super-admin": ["SUPER_ADMIN"],
    tenant: ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"],
    employee: ["MANAGER", "EMPLOYEE"],
    client: ["CLIENT_USER"],
  };
  return preference[portal].find((role) => roles.includes(role)) ?? roles[0] ?? defaultRoleForPortal(portal);
}

function defaultRoleForPortal(portal: CurrentUserPortal): string {
  switch (portal) {
    case "super-admin":
      return "SUPER_ADMIN";
    case "tenant":
      return "TENANT_ADMIN";
    case "employee":
      return "EMPLOYEE";
    case "client":
      return "CLIENT_USER";
    default: {
      const exhaustive: never = portal;
      return exhaustive;
    }
  }
}
