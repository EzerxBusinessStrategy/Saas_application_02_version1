export const locales = ["en", "bn", "hi", "or"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const appLocaleCookie = "saas-app-locale";

export const timezones = [
  { code: "IN", country: "India", city: "Kolkata", timezone: "Asia/Kolkata" },
  { code: "US", country: "USA", city: "New York", timezone: "America/New_York" },
  { code: "GB", country: "United Kingdom", city: "London", timezone: "Europe/London" },
  { code: "SG", country: "Singapore", city: "Singapore", timezone: "Asia/Singapore" },
  { code: "AU", country: "Australia", city: "Sydney", timezone: "Australia/Sydney" },
  { code: "DE", country: "Germany", city: "Berlin", timezone: "Europe/Berlin" },
] as const;

export type AppTimezone = (typeof timezones)[number]["timezone"];

export const languageOptions = [
  { locale: "en", code: "EN", label: "English", nativeLabel: "English" },
  { locale: "bn", code: "BN", label: "Bengali", nativeLabel: "বাংলা" },
  { locale: "hi", code: "HI", label: "Hindi", nativeLabel: "हिन्दी" },
  { locale: "or", code: "OR", label: "Odia", nativeLabel: "ଓଡ଼ିଆ" },
] as const satisfies readonly {
  readonly locale: AppLocale;
  readonly code: string;
  readonly label: string;
  readonly nativeLabel: string;
}[];

export function normalizeLocale(value: string | undefined | null): AppLocale {
  return locales.includes(value as AppLocale) ? (value as AppLocale) : defaultLocale;
}

export function localeForFormatting(locale: AppLocale): string {
  return ({ en: "en-IN", bn: "bn-IN", hi: "hi-IN", or: "or-IN" } as const)[locale];
}
