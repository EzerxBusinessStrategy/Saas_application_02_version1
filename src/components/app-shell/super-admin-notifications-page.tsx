"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSuperAdminNotifications,
  markAllSuperAdminNotificationsRead,
  markSuperAdminNotificationRead,
} from "@/features/platform/api/super-admin-notifications-api";

const notificationsQueryKey = ["super-admin-notifications", "recent"] as const;

export function SuperAdminNotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => getSuperAdminNotifications({ status: "ALL", limit: 50 }),
  });
  const markRead = useMutation({
    mutationFn: markSuperAdminNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
  const markAllRead = useMutation({
    mutationFn: markAllSuperAdminNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Super Admin</p>
          <h1 className="text-2xl font-semibold">Notifications</h1>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={!query.data?.unreadCount}>
          <CheckCheck className="size-4" aria-hidden="true" />
          Mark all read
        </Button>
      </div>

      <div className="rounded-[var(--radius-card)] border bg-card">
        {query.isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading notifications...</p> : null}
        {query.isError ? <p className="p-5 text-sm text-danger">Notifications could not load.</p> : null}
        {query.data && !query.data.items.length ? (
          <p className="p-5 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : null}
        {query.data?.items.map((item) => (
          <Link
            key={item.id}
            href={item.actionUrl ?? "/super-admin"}
            className="flex gap-3 border-b px-5 py-4 last:border-b-0 hover:bg-muted"
            onClick={() => {
              if (!item.readAt) markRead.mutate(item.id);
            }}
          >
            <Bell className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">
                {item.title}
                {!item.readAt ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.message}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
