export const appLocales = ["en", "bn", "hi", "or"] as const;
export type AppLocale = (typeof appLocales)[number];

export const appTimezones = [
  "Asia/Kolkata",
  "America/New_York",
  "Europe/London",
  "Asia/Singapore",
  "Australia/Sydney",
  "Europe/Berlin",
] as const;
export type AppTimezone = (typeof appTimezones)[number];

export type UserPreferences = {
  readonly locale: AppLocale;
  readonly timezone: AppTimezone;
};
