"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { languageOptions, normalizeLocale, type AppTimezone } from "@/i18n/config";
import { updateUserPreferences } from "@/features/identity/api/user-preferences-api";

export function LanguageSelector({ timezone }: { timezone: AppTimezone }) {
  const locale = normalizeLocale(useLocale());
  const router = useRouter();
  const t = useTranslations("Common");
  const [changing, setChanging] = useState(false);
  const [, startTransition] = useTransition();
  const selected = languageOptions.find((language) => language.locale === locale) ?? languageOptions[0];

  async function selectLanguage(nextLocale: typeof locale) {
    if (nextLocale === locale || changing) return;
    setChanging(true);
    try {
      await updateUserPreferences({ locale: nextLocale, timezone });
      startTransition(() => router.refresh());
    } finally {
      setChanging(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-1 rounded-[var(--radius-control)] px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label={t("language")}
        title={t("language")}
        disabled={changing}
      >
        <Languages className="size-[17px]" aria-hidden="true" />
        <span>{selected.code}</span>
        <ChevronDown className="size-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languageOptions.map((language) => (
          <DropdownMenuItem
            key={language.locale}
            className="flex cursor-pointer items-center justify-between"
            disabled={changing}
            onSelect={() => void selectLanguage(language.locale)}
          >
            <span className="flex flex-col">
              <span className="font-medium">{language.nativeLabel}</span>
              {language.nativeLabel !== language.label ? <span className="text-xs text-muted-foreground">{language.label}</span> : null}
            </span>
            {language.locale === locale ? <Check className="size-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
