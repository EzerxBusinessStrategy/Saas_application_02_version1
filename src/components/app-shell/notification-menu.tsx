"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/app-shell";
import type { Workspace } from "@/types/domain";

export type NotificationMenuState = "ready" | "loading" | "error" | "empty";

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
  const [items, setItems] = useState(initialItems);
  const visibleItems = items.filter(
    (item) => !item.workspaces?.length || item.workspaces.includes(workspace),
  );
  const unreadCount = useMemo(
    () => visibleItems.filter((item) => !item.read).length,
    [visibleItems],
  );
  const markAsRead = (id: string) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  const markAllAsRead = () =>
    setItems((current) => current.map((item) => ({ ...item, read: true })));

  return (
    <DropdownMenu open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={
            unreadCount
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="relative size-10 p-0"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount ? (
            <span
              className={cn(
                "absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-destructive-foreground",
                workspace === "super-admin" &&
                  "super-admin-notification-signal",
              )}
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] max-md:!fixed max-md:!inset-x-4 max-md:!bottom-4 max-md:!top-auto"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <DropdownMenuLabel className="p-0 font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount && state === "ready" ? (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        {state === "loading" ? (
          <div
            className="space-y-3 px-3 py-4"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : null}
        {state === "error" ? (
          <div className="px-3 py-5 text-sm">
            <p className="font-medium">Notifications could not be loaded</p>
            <p className="mt-1 text-muted-foreground">
              Try again once the notification service is available.
            </p>
          </div>
        ) : null}
        {state === "empty" || (state === "ready" && !visibleItems.length) ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : null}
        {state === "ready" && visibleItems.length ? (
          <div className="max-h-80 overflow-y-auto p-1">
            {visibleItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start whitespace-normal p-0"
                onSelect={() => markAsRead(item.id)}
                asChild
              >
                <Link
                  href={item.href ?? `/${workspace}`}
                  className="flex w-full gap-3 px-3 py-3"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
                    aria-label={item.read ? "Read" : "Unread"}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.createdAt}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : null}
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href={`/${workspace}/notifications`}>
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
