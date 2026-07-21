"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CommandMenu } from "@/components/app-shell/command-menu";
import { NotificationMenu } from "@/components/app-shell/notification-menu";
import { TenantSwitcher } from "@/components/app-shell/tenant-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
import { navigationFor } from "@/lib/nav";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { User, Workspace } from "@/types/domain";
import type { NavigationItem } from "@/types/navigation";

function filterNavigation(
  items: NavigationItem[],
  role: User["role"],
): NavigationItem[] {
  return items.flatMap((item) => {
    const children = item.children
      ? filterNavigation(item.children, role)
      : undefined;
    if (children?.length) return [{ ...item, children }];
    if (item.children) return [];
    return hasAnyPermission(role, item.permissions) ? [{ ...item }] : [];
  });
}

function isActiveItem(
  item: NavigationItem,
  pathname: string,
  workspace: Workspace,
): boolean {
  const href =
    item.href !== undefined ? `/${workspace}${item.href}` : undefined;
  if (
    href &&
    (pathname === href || (item.href && pathname.startsWith(`${href}/`)))
  )
    return true;
  return (
    item.children?.some((child) => isActiveItem(child, pathname, workspace)) ??
    false
  );
}

function WorkspaceNavigation({
  items,
  pathname,
  workspace,
  collapsed,
  onExpand,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  workspace: Workspace;
  collapsed: boolean;
  onExpand: () => void;
  onNavigate?: () => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const renderItem = (item: NavigationItem, nested = false) => {
    const active = isActiveItem(item, pathname, workspace);
    const Icon = item.icon;
    const href =
      item.href !== undefined ? `/${workspace}${item.href}` : undefined;
    const hasChildren = Boolean(item.children?.length);
    const expanded = expandedGroups[item.label] ?? active;
    const commonClassName = cn(
      "flex min-h-10 items-center gap-2.5 rounded-[3px] text-base leading-6 transition-colors hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
      collapsed ? "justify-center px-2" : nested ? "pl-10 pr-3" : "px-[15px]",
      active && "bg-sidebar-active font-medium text-white",
    );

    if (!hasChildren && href) {
      return (
        <Link
          key={item.label}
          href={href}
          className={commonClassName}
          title={collapsed ? item.label : undefined}
          aria-label={collapsed ? item.label : undefined}
          onClick={onNavigate}
        >
          {Icon ? (
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          ) : null}
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          ) : null}
          {!collapsed && item.badge ? (
            <span className="ml-auto rounded-[var(--radius-control)] bg-primary px-[7px] py-px text-xs leading-[18px] text-white">
              {item.badge}
            </span>
          ) : null}
        </Link>
      );
    }

    return (
      <div key={item.label}>
        <button
          type="button"
          className={commonClassName}
          aria-expanded={collapsed ? undefined : expanded}
          aria-label={
            collapsed ? `Expand sidebar to view ${item.label}` : undefined
          }
          title={collapsed ? item.label : undefined}
          onClick={() => {
            if (collapsed) {
              onExpand();
              return;
            }
            setExpandedGroups((current) => ({
              ...current,
              [item.label]: !expanded,
            }));
          }}
        >
          {Icon ? (
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          ) : null}
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          ) : null}
          {!collapsed ? (
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden="true"
            />
          ) : null}
        </button>
        {!collapsed && expanded && item.children ? (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => renderItem(child, true))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <nav
      className="flex flex-1 flex-col gap-1.5 px-3 py-8"
      aria-label="Workspace navigation"
    >
      {items.map((item) => renderItem(item))}
    </nav>
  );
}

function Sidebar({
  items,
  pathname,
  workspace,
  collapsed,
  onExpand,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  workspace: Workspace;
  collapsed: boolean;
  onExpand: () => void;
  onNavigate?: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width]",
        collapsed ? "w-[72px]" : "w-[var(--sidebar-width)]",
      )}
    >
      <div
        className={cn(
          "flex h-[var(--header-height)] items-center gap-3",
          collapsed ? "justify-center px-3" : "px-10",
        )}
      >
        <Image
          src="/branding/default-mark.svg"
          alt="Acme Ops"
          width={32}
          height={32}
          priority
        />
        {!collapsed ? (
          <span className="truncate text-lg font-bold tracking-tight text-white">
            Acme Ops
          </span>
        ) : null}
      </div>
      <WorkspaceNavigation
        items={items}
        pathname={pathname}
        workspace={workspace}
        collapsed={collapsed}
        onExpand={onExpand}
        onNavigate={onNavigate}
      />
      {!collapsed ? (
        <div
          className="mt-auto truncate px-[25px] py-6 text-sm text-sidebar-muted"
          title="Tenant workspace · Demo data"
        >
          Tenant workspace · Demo data
        </div>
      ) : null}
    </aside>
  );
}

export function WorkspaceShell({
  workspace,
  user,
  children,
}: {
  workspace: Workspace;
  user: User;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const items = useMemo(
    () => filterNavigation(navigationFor(workspace), user.role),
    [user.role, workspace],
  );

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [pathname]);

  useEffect(() => {
    const openCommandMenu = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandMenuOpen(true);
      }
    };
    window.addEventListener("keydown", openCommandMenu);
    return () => window.removeEventListener("keydown", openCommandMenu);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
        <Sidebar
          items={items}
          pathname={pathname}
          workspace={workspace}
          collapsed={sidebarCollapsed}
          onExpand={() => setSidebarCollapsed(false)}
        />
      </aside>
      <Dialog
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      >
        <DialogContent
          title="Workspace navigation"
          className="left-0 top-0 h-dvh w-[min(var(--sidebar-width),calc(100vw-2rem))] max-w-none -translate-x-0 -translate-y-0 rounded-none border-y-0 border-l-0 p-0"
        >
          <Sidebar
            items={items}
            pathname={pathname}
            workspace={workspace}
            collapsed={false}
            onExpand={() => undefined}
            onNavigate={() => setMobileNavigationOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <div
        className={cn(
          "transition-[padding]",
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[var(--sidebar-width)]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-[var(--header-height)] items-center justify-between gap-3 border-b bg-card px-4 lg:px-10">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open navigation"
              className="size-10 p-0 lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu className="size-[18px]" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
              className="hidden size-10 p-0 lg:inline-flex"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-[18px]" aria-hidden="true" />
              )}
            </Button>
            <div className="hidden min-w-0 md:block">
              <Breadcrumbs
                pathname={pathname}
                workspace={workspace}
                role={user.role}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {user.role === "SUPER_ADMIN" ? <TenantSwitcher /> : null}
            <WorkspaceSwitcher currentWorkspace={workspace} />
            <Button
              variant="outline"
              size="sm"
              className="size-10 justify-center p-0 sm:w-52 sm:justify-start sm:px-3"
              aria-label="Search workspace navigation"
              onClick={() => setCommandMenuOpen(true)}
            >
              <Search className="size-[18px]" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-auto hidden text-xs text-muted-foreground sm:block">
                ⌘K
              </kbd>
            </Button>
            <NotificationMenu workspace={workspace} />
            <UserMenu user={user} />
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1290px] px-4 py-6 sm:px-6 lg:px-0 lg:py-[45px]"
        >
          {children}
        </main>
      </div>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        workspace={workspace}
        role={user.role}
      />
    </div>
  );
}
