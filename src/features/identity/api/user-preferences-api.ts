import type { AppLocale, AppTimezone } from "@/i18n/config";

export type UserPreferences = {
  locale: AppLocale;
  timezone: AppTimezone;
};

export async function updateUserPreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const response = await fetch("/api/me/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) throw new Error("Preferences could not be updated.");
  const body = (await response.json()) as { preferences: UserPreferences };
  return body.preferences;
}
