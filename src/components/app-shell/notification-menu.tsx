"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, CircleAlert, Info, Volume2, VolumeX } from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { notificationFixtures } from "@/mocks/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getSuperAdminNotifications,
  markAllSuperAdminNotificationsRead,
  markSuperAdminNotificationRead,
} from "@/features/platform/api/super-admin-notifications-api";
import {
  getTenantAdminNotifications,
  markAllTenantAdminNotificationsRead,
  markTenantAdminNotificationRead,
} from "@/features/tenant-admin/api/tenant-admin-notifications-api";
import {
  getEmployeeNotifications,
  markAllEmployeeNotificationsRead,
  markEmployeeNotificationRead,
} from "@/features/employee/api/employee-notifications-api";
import { getClientPortalNotifications } from "@/features/client-portal/api/client-portal-notifications-api";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/app-shell";
import type { Workspace } from "@/types/domain";
import type {
  SuperAdminNotification,
  SuperAdminNotificationsResponse,
} from "@/types/super-admin-notifications";

export type NotificationMenuState = "ready" | "loading" | "error" | "empty";

const superAdminNotificationsQueryKey = ["super-admin-notifications", "recent"] as const;
const tenantAdminNotificationsQueryKey = ["tenant-admin-notifications", "recent"] as const;
const employeeNotificationsQueryKey = ["employee-notifications", "recent"] as const;
const clientPortalNotificationsQueryKey = ["client-portal-notifications", "recent"] as const;

const superAdminSoundPreferenceKey = "super-admin-notification-sound-enabled";
const tenantAdminSoundPreferenceKey = "tenant-admin-notification-sound-enabled";

export function NotificationMenu({
  workspace,
  initialItems = notificationFixtures,
  state = "ready",
  open,
}: {
  workspace: Workspace;
  initialItems?: Notification[];
  state?: NotificationMenuState;
  open?: boolean;
}) {
  if (workspace === "super-admin") {
    return <SuperAdminNotificationMenu open={open} />;
  }
  if (workspace === "admin") {
    return <TenantAdminNotificationMenu open={open} />;
  }
  if (workspace === "client") {
    return <ClientPortalNotificationMenu open={open} />;
  }
  if (workspace === "employee") {
    return <EmployeeNotificationMenu open={open} />;
  }
  return <MockNotificationMenu workspace={workspace} initialItems={initialItems} state={state} open={open} />;
}

function SuperAdminNotificationMenu({ open }: { open?: boolean }) {
  const queryClient = useQueryClient();
  const processedIds = useRef(new Set<string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const query = useQuery({
    queryKey: superAdminNotificationsQueryKey,
    queryFn: () => getSuperAdminNotifications({ status: "ALL", limit: 20 }),
  });
  const data = query.data;
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markRead = useMutation(
    optimisticReadMutation(queryClient, superAdminNotificationsQueryKey, markSuperAdminNotificationRead),
  );
  const markAllRead = useMutation(
    optimisticMarkAllReadMutation(queryClient, superAdminNotificationsQueryKey, markAllSuperAdminNotificationsRead),
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(superAdminSoundPreferenceKey);
    setSoundEnabled(stored !== "false");
    audioRef.current = new Audio("/sounds/notification.wav");
    audioRef.current.volume = 0.45;
  }, []);

  useEffect(() => {
    const socket = io(`${socketBaseUrl()}/super-admin/notifications`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (item: SuperAdminNotification) => {
      if (processedIds.current.has(item.id)) return;
      processedIds.current.add(item.id);
      queryClient.setQueryData<SuperAdminNotificationsResponse>(superAdminNotificationsQueryKey, (current) => {
        if (!current) return { unreadCount: 1, items: [item] };
        if (current.items.some((existing) => existing.id === item.id)) return current;
        return { unreadCount: current.unreadCount + 1, items: [item, ...current.items].slice(0, 20) };
      });
      toast(item.title, { description: item.message });
      if (soundEnabled) void playNotificationSound(audioRef.current);
    });

    socket.on("connect", () => {
      void queryClient.invalidateQueries({ queryKey: superAdminNotificationsQueryKey });
    });

    socket.on("reconnect", () => {
      void queryClient.invalidateQueries({ queryKey: superAdminNotificationsQueryKey });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      window.localStorage.setItem(superAdminSoundPreferenceKey, String(!enabled));
      return !enabled;
    });
  };

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-10 p-0"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? (
            <span
              className="super-admin-notification-signal absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] max-md:!fixed max-md:!inset-x-4 max-md:!bottom-4 max-md:!top-auto"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleSound} title="Toggle notification sound">
              {soundEnabled ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
              <span className="sr-only">Toggle notification sound</span>
            </Button>
            {unreadCount ? (
              <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="size-4" aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {query.isLoading ? <NotificationLoading /> : null}
        {query.isError ? <NotificationError /> : null}
        {!query.isLoading && !query.isError && !items.length ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">You&apos;re all caught up.</div>
        ) : null}
        {!query.isLoading && !query.isError && items.length ? (
          <NotificationList items={items} onRead={(id) => markRead.mutate(id)} defaultHref="/super-admin" />
        ) : null}
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href="/super-admin/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TenantAdminNotificationMenu({ open }: { open?: boolean }) {
  const queryClient = useQueryClient();
  const processedIds = useRef(new Set<string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const query = useQuery({
    queryKey: tenantAdminNotificationsQueryKey,
    queryFn: () => getTenantAdminNotifications({ status: "ALL", limit: 20 }),
  });
  const data = query.data;
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markRead = useMutation(
    optimisticReadMutation(queryClient, tenantAdminNotificationsQueryKey, markTenantAdminNotificationRead),
  );
  const markAllRead = useMutation(
    optimisticMarkAllReadMutation(queryClient, tenantAdminNotificationsQueryKey, markAllTenantAdminNotificationsRead),
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(tenantAdminSoundPreferenceKey);
    setSoundEnabled(stored !== "false");
    audioRef.current = new Audio("/sounds/notification.wav");
    audioRef.current.volume = 0.45;
  }, []);

  useEffect(() => {
    const socket = io(`${socketBaseUrl()}/tenant-admin/notifications`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (item: SuperAdminNotification) => {
      if (processedIds.current.has(item.id)) return;
      processedIds.current.add(item.id);
      queryClient.setQueryData<SuperAdminNotificationsResponse>(tenantAdminNotificationsQueryKey, (current) => {
        if (!current) return { unreadCount: 1, items: [item] };
        if (current.items.some((existing) => existing.id === item.id)) return current;
        return { unreadCount: current.unreadCount + 1, items: [item, ...current.items].slice(0, 20) };
      });
      toast(item.title, { description: item.message });
      void queryClient.invalidateQueries({ queryKey: ["operational-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-billable-task-entries"] });
      if (soundEnabled) void playNotificationSound(audioRef.current);
    });

    socket.on("connect", () => {
      void queryClient.invalidateQueries({ queryKey: tenantAdminNotificationsQueryKey });
    });

    socket.on("reconnect", () => {
      void queryClient.invalidateQueries({ queryKey: tenantAdminNotificationsQueryKey });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      window.localStorage.setItem(tenantAdminSoundPreferenceKey, String(!enabled));
      return !enabled;
    });
  };

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-10 p-0"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? (
            <span
              className="tenant-admin-notification-signal absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] max-md:!fixed max-md:!inset-x-4 max-md:!bottom-4 max-md:!top-auto"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleSound} title="Toggle notification sound">
              {soundEnabled ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
              <span className="sr-only">Toggle notification sound</span>
            </Button>
            {unreadCount ? (
              <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="size-4" aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {query.isLoading ? <NotificationLoading /> : null}
        {query.isError ? <NotificationError /> : null}
        {!query.isLoading && !query.isError && !items.length ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">You&apos;re all caught up.</div>
        ) : null}
        {!query.isLoading && !query.isError && items.length ? (
          <NotificationList items={items} onRead={(id) => markRead.mutate(id)} defaultHref="/admin" />
        ) : null}
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href="/admin">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmployeeNotificationMenu({ open }: { open?: boolean }) {
  const queryClient = useQueryClient();
  const processedIds = useRef(new Set<string>());
  const query = useQuery({
    queryKey: employeeNotificationsQueryKey,
    queryFn: getEmployeeNotifications,
    refetchInterval: 30_000,
  });
  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  const markRead = useMutation(
    optimisticReadMutation(queryClient, employeeNotificationsQueryKey, markEmployeeNotificationRead),
  );
  const markAllRead = useMutation(
    optimisticMarkAllReadMutation(queryClient, employeeNotificationsQueryKey, markAllEmployeeNotificationsRead),
  );

  useEffect(() => {
    const socket = io(`${socketBaseUrl()}/employee/notifications`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (item: SuperAdminNotification) => {
      if (processedIds.current.has(item.id)) return;
      processedIds.current.add(item.id);
      queryClient.setQueryData<SuperAdminNotificationsResponse>(employeeNotificationsQueryKey, (current) => {
        if (!current) return { unreadCount: 1, items: [item] };
        if (current.items.some((existing) => existing.id === item.id)) return current;
        return { unreadCount: current.unreadCount + 1, items: [item, ...current.items].slice(0, 20) };
      });
      toast(item.title, { description: item.message });
      void queryClient.invalidateQueries({ queryKey: ["operational-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-manager-reviews"] });
    });
    socket.on("connect", () => void queryClient.invalidateQueries({ queryKey: employeeNotificationsQueryKey }));

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className="relative size-10 p-0">
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] max-md:!fixed max-md:!inset-x-4 max-md:!bottom-4 max-md:!top-auto">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount ? <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}><CheckCheck className="size-4" aria-hidden="true" />Mark all read</Button> : null}
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {query.isLoading ? <NotificationLoading /> : null}
        {query.isError ? <NotificationError /> : null}
        {!query.isLoading && !query.isError && !items.length ? <div className="px-3 py-5 text-sm text-muted-foreground">You&apos;re all caught up.</div> : null}
        {!query.isLoading && !query.isError && items.length ? <NotificationList items={items} onRead={(id) => markRead.mutate(id)} defaultHref="/employee" /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClientPortalNotificationMenu({ open }: { open?: boolean }) {
  const query = useQuery({
    queryKey: clientPortalNotificationsQueryKey,
    queryFn: getClientPortalNotifications,
    refetchOnWindowFocus: true,
  });
  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-10 p-0"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? (
            <span
              className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] max-md:!fixed max-md:!inset-x-4 max-md:!bottom-4 max-md:!top-auto"
      >
        <DropdownMenuLabel className="px-3 py-2 font-semibold">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {query.isLoading ? <NotificationLoading /> : null}
        {query.isError ? <NotificationError /> : null}
        {!query.isLoading && !query.isError && !items.length ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">You&apos;re all caught up.</div>
        ) : null}
        {!query.isLoading && !query.isError && items.length ? (
          <NotificationList items={items} onRead={() => undefined} defaultHref="/client/notifications" />
        ) : null}
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href="/client/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationList({
  items,
  onRead,
  defaultHref,
}: {
  items: SuperAdminNotification[];
  onRead: (id: string) => void;
  defaultHref: string;
}) {
  return (
    <div className="max-h-80 overflow-y-auto p-1">
      {items.map((item) => {
        const unread = !item.readAt;
        const Icon = item.severity === "INFO" || item.severity === "SUCCESS" ? Info : CircleAlert;
        return (
          <DropdownMenuItem key={item.id} className="items-start whitespace-normal p-0" asChild>
            <Link
              href={item.actionUrl ?? defaultHref}
              className={cn("flex w-full gap-3 px-3 py-3", unread && "bg-muted/70")}
              onClick={() => {
                if (unread) onRead(item.id);
              }}
            >
              <span className={cn("mt-1 grid size-6 shrink-0 place-items-center rounded-full", severityClass(item.severity))}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate font-medium">{item.title}</span>
                  {unread ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.message}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(item.createdAt)}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

function MockNotificationMenu({
  workspace,
  initialItems,
  state,
  open,
}: {
  workspace: Workspace;
  initialItems: Notification[];
  state: NotificationMenuState;
  open?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const visibleItems = items.filter((item) => !item.workspaces?.length || item.workspaces.includes(workspace));
  const unreadCount = useMemo(() => visibleItems.filter((item) => !item.read).length, [visibleItems]);
  const markAsRead = (id: string) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  const markAllAsRead = () => setItems((current) => current.map((item) => ({ ...item, read: true })));

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-10 p-0"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground" aria-hidden="true">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount && state === "ready" ? (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {state === "loading" ? <NotificationLoading /> : null}
        {state === "error" ? <NotificationError /> : null}
        {state === "empty" || (state === "ready" && !visibleItems.length) ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">You&apos;re all caught up.</div>
        ) : null}
        {state === "ready" && visibleItems.length ? (
          <div className="max-h-80 overflow-y-auto p-1">
            {visibleItems.map((item) => (
              <DropdownMenuItem key={item.id} className="items-start whitespace-normal p-0" onSelect={() => markAsRead(item.id)} asChild>
                <Link href={item.href ?? `/${workspace}`} className="flex w-full gap-3 px-3 py-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`} aria-label={item.read ? "Read" : "Unread"} />
                  <span className="min-w-0">
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.createdAt}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationLoading() {
  return (
    <div className="space-y-3 px-3 py-4" aria-live="polite" aria-busy="true">
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );
}

function NotificationError() {
  return (
    <div className="px-3 py-5 text-sm">
      <p className="font-medium">Notifications could not be loaded</p>
      <p className="mt-1 text-muted-foreground">Try again once the notification service is available.</p>
    </div>
  );
}

function markItemRead(data: SuperAdminNotificationsResponse, notificationId: string): SuperAdminNotificationsResponse {
  const item = data.items.find((current) => current.id === notificationId);
  const decrement = item && !item.readAt ? 1 : 0;
  return {
    unreadCount: Math.max(0, data.unreadCount - decrement),
    items: data.items.map((current) =>
      current.id === notificationId ? { ...current, readAt: current.readAt ?? new Date().toISOString() } : current,
    ),
  };
}

type NotificationRollback = {
  readonly previous: SuperAdminNotificationsResponse | undefined;
};

function optimisticReadMutation(
  queryClient: QueryClient,
  queryKey: QueryKey,
  mutationFn: (notificationId: string) => Promise<unknown>,
) {
  return {
    mutationFn,
    async onMutate(notificationId: string): Promise<NotificationRollback> {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SuperAdminNotificationsResponse>(queryKey);
      queryClient.setQueryData<SuperAdminNotificationsResponse>(queryKey, (current) =>
        current ? markItemRead(current, notificationId) : current,
      );
      return { previous };
    },
    onError(_error: unknown, _notificationId: string, rollback: NotificationRollback | undefined) {
      queryClient.setQueryData(queryKey, rollback?.previous);
    },
    onSettled() {
      return queryClient.invalidateQueries({ queryKey });
    },
  };
}

function optimisticMarkAllReadMutation(
  queryClient: QueryClient,
  queryKey: QueryKey,
  mutationFn: () => Promise<unknown>,
) {
  return {
    mutationFn,
    async onMutate(): Promise<NotificationRollback> {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SuperAdminNotificationsResponse>(queryKey);
      queryClient.setQueryData<SuperAdminNotificationsResponse>(queryKey, (current) =>
        current
          ? {
              unreadCount: 0,
              items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
            }
          : current,
      );
      return { previous };
    },
    onError(_error: unknown, _variables: void, rollback: NotificationRollback | undefined) {
      queryClient.setQueryData(queryKey, rollback?.previous);
    },
    onSettled() {
      return queryClient.invalidateQueries({ queryKey });
    },
  };
}

function severityClass(severity: SuperAdminNotification["severity"]): string {
  if (severity === "CRITICAL") return "bg-danger/10 text-danger";
  if (severity === "WARNING") return "bg-warning/15 text-warning";
  if (severity === "SUCCESS") return "bg-success/10 text-success";
  return "bg-primary/10 text-primary";
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function socketBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  return (configured ?? "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
}

async function playNotificationSound(audio: HTMLAudioElement | null): Promise<void> {
  try {
    if (!audio) return;
    audio.currentTime = 0;
    await audio.play();
  } catch {
    // Browsers can block sound until the user interacts with the app.
  }
}
