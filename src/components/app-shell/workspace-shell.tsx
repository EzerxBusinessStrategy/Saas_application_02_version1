"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  RefreshCw,
  Search,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CommandMenu } from "@/components/app-shell/command-menu";
import { HeaderUtilityButton } from "@/components/app-shell/header-utility-button";
import { LiveWorldClock } from "@/components/app-shell/live-world-clock";
import { LanguageSelector } from "@/components/app-shell/language-selector";
import { NotificationMenu } from "@/components/app-shell/notification-menu";
import { PendingActionIndicator } from "@/components/app-shell/pending-action-indicator";
import { ClientTaskFeedbackPrompt } from "@/components/operations/client-task-feedback-prompt";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/app-shell/user-menu";
import { SidebarWhatsNewButton, useWhatsNewUnseen, WhatsNewDialog } from "@/components/app-shell/whats-new-dialog";
import { BoxBuildLoader } from "@/components/shared/box-build-loader";
import { getClientPortalProfile } from "@/features/client-portal/api/client-portal-profile-api";
import { getTenantProfile } from "@/features/operations/api/operations-api";
import { getPlatformConfiguration } from "@/features/platform/api/super-admin-platform-configuration-api";
import { navigationFor } from "@/lib/nav";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { timezones } from "@/i18n/config";
import type { User, Workspace } from "@/types/domain";
import type { NavigationItem } from "@/types/navigation";

function filterNavigation(
  items: NavigationItem[],
  roles: readonly User["role"][],
): NavigationItem[] {
  return items.flatMap((item) => {
    const children = item.children
      ? filterNavigation(item.children, roles)
      : undefined;
    if (children?.length) return [{ ...item, children }];
    if (item.children) return [];
    return roles.some((role) => hasAnyPermission(role, item.permissions))
      ? [{ ...item }]
      : [];
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

function activeParentLabel(
  items: NavigationItem[],
  pathname: string,
  workspace: Workspace,
): string | null {
  return (
    items.find(
      (item) =>
        Boolean(item.children?.length) && isActiveItem(item, pathname, workspace),
    )?.label ?? null
  );
}

function WorkspaceNavigation({
  items,
  pathname,
  workspace,
  collapsed,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  workspace: Workspace;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() =>
    activeParentLabel(items, pathname, workspace),
  );
  const [openFlyoutGroup, setOpenFlyoutGroup] = useState<string | null>(null);

  useEffect(() => {
    setExpandedGroup(activeParentLabel(items, pathname, workspace));
  }, [items, pathname, workspace]);
  const labelClassName = cn(
    "min-w-0 flex-1 truncate transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
    collapsed
      ? "pointer-events-none absolute -translate-x-1 opacity-0"
      : "translate-x-0 opacity-100",
  );
  const labelFor = (item: NavigationItem) =>
    item.labelKey ? t(item.labelKey) : item.label;

  const renderFlyoutItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const href =
      item.href !== undefined ? `/${workspace}${item.href}` : undefined;
    const active = isActiveItem(item, pathname, workspace);
    return href ? (
      <Link
        key={item.label}
        href={href}
        className={cn(
          "flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
          active && "bg-sidebar-active font-medium text-sidebar-foreground",
        )}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          setOpenFlyoutGroup(null);
          onNavigate?.();
        }}
      >
        {Icon ? (
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        ) : null}
        <span className="truncate">{labelFor(item)}</span>
      </Link>
    ) : null;
  };

  const renderItem = (item: NavigationItem, nested = false) => {
    const active = isActiveItem(item, pathname, workspace);
    const Icon = item.icon;
    const href =
      item.href !== undefined ? `/${workspace}${item.href}` : undefined;
    const hasChildren = Boolean(item.children?.length);
    const expanded = nested ? active : expandedGroup === item.label;
    const itemId = item.label.toLowerCase().replaceAll(" ", "-");
    const tooltipId = `${workspace}-${itemId}-tooltip`;
    const commonClassName = cn(
      "group relative flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] text-sm leading-5 text-sidebar-foreground transition-colors duration-200 ease-out hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none",
      collapsed ? "justify-center px-2" : nested ? "pl-9 pr-3" : "px-3",
      active && "bg-sidebar-active font-medium text-sidebar-foreground",
    );
    const tooltip =
      collapsed && openFlyoutGroup !== item.label ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none invisible absolute left-[calc(100%+8px)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-foreground px-2 py-1 text-xs text-card opacity-0 shadow-sm transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none"
        >
          {labelFor(item)}
        </span>
      ) : null;

    if (!hasChildren && href) {
      return (
        <Link
          key={item.label}
          href={href}
          className={commonClassName}
          title={collapsed ? labelFor(item) : undefined}
          aria-label={collapsed ? labelFor(item) : undefined}
          aria-describedby={collapsed ? tooltipId : undefined}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {Icon ? (
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          ) : null}
          <span aria-hidden={collapsed} className={labelClassName}>
            {labelFor(item)}
          </span>
          {!collapsed && item.badge ? (
            <span className="ml-auto rounded-[var(--radius-control)] bg-primary px-[7px] py-px text-xs leading-[18px] text-primary-foreground">
              {item.badge}
            </span>
          ) : null}
          {tooltip}
        </Link>
      );
    }

    return (
      <div key={item.label} className="relative">
        <button
          type="button"
          className={commonClassName}
          aria-expanded={collapsed ? openFlyoutGroup === item.label : expanded}
          aria-label={collapsed ? `${labelFor(item)} navigation` : undefined}
          title={collapsed ? labelFor(item) : undefined}
          aria-describedby={
            collapsed && openFlyoutGroup !== item.label ? tooltipId : undefined
          }
          aria-controls={collapsed ? `${itemId}-navigation` : undefined}
          onClick={() => {
            if (collapsed) {
              setOpenFlyoutGroup((current) =>
                current === item.label ? null : item.label,
              );
              return;
            }
            setExpandedGroup((current) =>
              current === item.label ? null : item.label,
            );
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpenFlyoutGroup(null);
          }}
        >
          {Icon ? (
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          ) : null}
          <span aria-hidden={collapsed} className={labelClassName}>
            {labelFor(item)}
          </span>
          {!collapsed ? (
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden="true"
            />
          ) : null}
          {tooltip}
        </button>
        {!collapsed && expanded && item.children ? (
          <div className="mt-1 flex flex-col gap-1">
            {item.children.map((child) => renderItem(child, true))}
          </div>
        ) : null}
        {collapsed && openFlyoutGroup === item.label && item.children ? (
          <div
            id={`${itemId}-navigation`}
            role="group"
            aria-label={`${labelFor(item)} navigation`}
            className="absolute left-[calc(100%+8px)] top-0 z-20 flex w-52 flex-col gap-1 rounded-[var(--radius-control)] border bg-sidebar p-2 shadow-[var(--shadow-card)]"
          >
            <p className="px-2 py-1 text-xs font-medium text-sidebar-muted">
              {labelFor(item)}
            </p>
            {item.children.map(renderFlyoutItem)}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <nav
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 px-3 py-5",
        collapsed ? "overflow-visible" : "overflow-y-auto scrollbar-none",
      )}
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
  companyName,
  onToggle,
  showToggle = true,
  onNavigate,
  onOpenWhatsNew,
  whatsNewActive,
  whatsNewUnseen,
}: {
  items: NavigationItem[];
  pathname: string;
  workspace: Workspace;
  collapsed: boolean;
  companyName: string;
  onToggle: () => void;
  showToggle?: boolean;
  onNavigate?: () => void;
  onOpenWhatsNew: () => void;
  whatsNewActive: boolean;
  whatsNewUnseen: boolean;
}) {
  return (
    <aside className="flex h-dvh min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-[var(--header-height)] items-center justify-between gap-2",
          collapsed ? "gap-0 px-1" : "px-3",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/branding/default-mark.svg"
            alt={collapsed ? companyName : ""}
            width={28}
            height={28}
            priority
          />
          <span
            aria-hidden={collapsed}
            className={cn(
              "truncate text-lg font-bold tracking-tight text-sidebar-foreground transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              collapsed
                ? "pointer-events-none absolute -translate-x-1 opacity-0"
                : "translate-x-0 opacity-100",
            )}
          >
            {companyName}
          </span>
        </div>
        {showToggle ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="group size-10 shrink-0 p-0 text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-foreground"
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronsRight
                className="size-[18px] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-active:translate-x-0 motion-reduce:transition-none"
                aria-hidden="true"
              />
            ) : (
              <ChevronsLeft
                className="size-[18px] transition-transform duration-200 ease-out group-hover:-translate-x-0.5 group-active:translate-x-0 motion-reduce:transition-none"
                aria-hidden="true"
              />
            )}
          </Button>
        ) : null}
      </div>
      <WorkspaceNavigation
        items={items}
        pathname={pathname}
        workspace={workspace}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <SidebarWhatsNewButton
        collapsed={collapsed}
        active={whatsNewActive}
        unseen={whatsNewUnseen}
        onOpen={onOpenWhatsNew}
      />
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
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const whatsNewUnseen = useWhatsNewUnseen(whatsNewOpen);
  const [companyName, setCompanyName] = useState("SaaS App");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const platformConfigurationQuery = useQuery({
    queryKey: ["platform-configuration"],
    queryFn: getPlatformConfiguration,
    enabled: workspace === "super-admin" && user.role === "SUPER_ADMIN",
  });
  const clientProfileQuery = useQuery({
    queryKey: ["client-portal-profile"],
    queryFn: getClientPortalProfile,
    enabled: workspace === "client" && user.role === "CLIENT_USER",
  });
  const tenantProfileQuery = useQuery({
    queryKey: ["tenant-profile"],
    queryFn: getTenantProfile,
    enabled: workspace === "admin",
  });
  const items = useMemo(
    () => filterNavigation(navigationFor(workspace, user.roles?.includes("MANAGER") ?? false), user.roles ?? [user.role]),
    [user.role, user.roles, workspace],
  );
  const updateWorkspace = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    router.refresh();
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setIsRefreshing(false);
    }
  };

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

  useEffect(() => {
    if (workspace === "super-admin") {
      const configuration = platformConfigurationQuery.data;
      setCompanyName(configuration?.platformName ?? "SaaS App");
      document.documentElement.style.setProperty("--primary", configuration?.defaultBrand ?? "#3C50E0");
      document.documentElement.style.setProperty("--ring", configuration?.defaultBrand ?? "#3C50E0");
      return;
    }
    if (workspace === "client") {
      const profile = clientProfileQuery.data;
      setCompanyName(profile?.portalName ?? "Client portal");
      document.documentElement.style.setProperty("--primary", profile?.primaryColour ?? "#3C50E0");
      document.documentElement.style.setProperty("--ring", profile?.primaryColour ?? "#3C50E0");
      return;
    }
    const profile = tenantProfileQuery.data;
    setCompanyName(profile?.name ?? "Tenant workspace");
    document.documentElement.style.setProperty("--primary", "#3C50E0");
    document.documentElement.style.setProperty("--ring", "#3C50E0");
  }, [clientProfileQuery.data, platformConfigurationQuery.data, tenantProfileQuery.data, user.role, workspace]);

  return (
    <div
      className="app-shell min-h-screen bg-background"
      data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
    >
      <PendingActionIndicator suppressed={pathname.endsWith("/tenant-password")} />
      {workspace === "client" && user.role === "CLIENT_USER" ? <ClientTaskFeedbackPrompt /> : null}
      {isRefreshing ? (
        <div className="fixed inset-0 z-[70] bg-background/85 backdrop-blur-sm">
          <BoxBuildLoader className="min-h-dvh" label="Updating workspace..." />
        </div>
      ) : null}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell__sidebar sticky top-0 hidden h-dvh min-w-0 self-start lg:block">
        <Sidebar
          items={items}
          pathname={pathname}
          workspace={workspace}
          collapsed={sidebarCollapsed}
          companyName={companyName}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onOpenWhatsNew={() => setWhatsNewOpen(true)}
          whatsNewActive={whatsNewOpen}
          whatsNewUnseen={whatsNewUnseen}
        />
      </div>
      <Dialog
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      >
        <DialogContent
          title="Workspace navigation"
          className="mobile-navigation-drawer left-0 top-0 h-dvh w-[min(var(--sidebar-expanded-width),calc(100vw-2rem))] max-w-none -translate-x-0 -translate-y-0 rounded-none border-y-0 border-l-0 p-0"
        >
          <Sidebar
            items={items}
            pathname={pathname}
            workspace={workspace}
            collapsed={false}
            companyName={companyName}
            onToggle={() => undefined}
            showToggle={false}
            onNavigate={() => setMobileNavigationOpen(false)}
            onOpenWhatsNew={() => {
              setMobileNavigationOpen(false);
              setWhatsNewOpen(true);
            }}
            whatsNewActive={whatsNewOpen}
            whatsNewUnseen={whatsNewUnseen}
          />
        </DialogContent>
      </Dialog>
      <div className="app-shell__main min-w-0">
        <header className="sticky top-0 z-20 flex h-[var(--header-height)] items-center justify-between gap-3 border-b bg-[var(--header-background)] px-4 text-[var(--header-foreground)] md:px-6 lg:px-8">
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
            <div className="hidden min-w-0 md:block">
              <Breadcrumbs
                pathname={pathname}
                workspace={workspace}
                role={user.role}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LiveWorldClock preferences={user.preferences} />
            <LanguageSelector timezone={user.preferences?.timezone ?? timezones[0].timezone} />
            <HeaderUtilityButton
              aria-label={t("Common.update")}
              title={t("Common.update")}
              disabled={isRefreshing}
              onClick={() => void updateWorkspace()}
            >
              <RefreshCw className="size-[18px]" aria-hidden="true" />
            </HeaderUtilityButton>
            <HeaderUtilityButton
              aria-label={t("CommandMenu.searchNavigation")}
              title={t("Common.search")}
              onClick={() => setCommandMenuOpen(true)}
            >
              <Search className="size-[18px]" aria-hidden="true" />
            </HeaderUtilityButton>
            <div className="flex items-center gap-2 pl-0.5 sm:pl-1">
              <ThemeToggle />
              {workspace !== "client" ? (
                <NotificationMenu workspace={workspace} userEmail={user.email} />
              ) : null}
              <UserMenu workspace={workspace} />
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className="min-w-0 px-4 py-6 md:px-6 lg:px-8"
          style={{ paddingBlock: "var(--tenant-main-padding-y, 1.5rem)" }}
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
      <WhatsNewDialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen} />
    </div>
  );
}
