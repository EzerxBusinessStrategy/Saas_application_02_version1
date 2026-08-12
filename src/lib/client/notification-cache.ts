"use client";

import type { SuperAdminNotificationsResponse } from "@/types/super-admin-notifications";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const CACHE_PREFIX = "saas-app:notifications";

type CachedNotifications = {
  version: number;
  expiresAt: number;
  data: SuperAdminNotificationsResponse;
};

function storageKey(workspace: string, userEmail: string) {
  return `${CACHE_PREFIX}:${workspace}:${userEmail.trim().toLowerCase()}`;
}

export function readNotificationCache(workspace: string, userEmail: string): SuperAdminNotificationsResponse | undefined {
  if (typeof window === "undefined" || !userEmail) return undefined;
  try {
    const key = storageKey(workspace, userEmail);
    const cached = JSON.parse(window.localStorage.getItem(key) ?? "null") as CachedNotifications | null;
    if (!cached || cached.version !== CACHE_VERSION || cached.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return cached.data;
  } catch {
    return undefined;
  }
}

export function writeNotificationCache(
  workspace: string,
  userEmail: string,
  data: SuperAdminNotificationsResponse,
) {
  if (typeof window === "undefined" || !userEmail) return;
  try {
    const cached: CachedNotifications = {
      version: CACHE_VERSION,
      expiresAt: Date.now() + CACHE_TTL_MS,
      data,
    };
    window.localStorage.setItem(storageKey(workspace, userEmail), JSON.stringify(cached));
  } catch {
    // Notification caching is a performance enhancement; the live query remains authoritative.
  }
}
