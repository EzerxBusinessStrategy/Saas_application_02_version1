export type PlatformConfigurationDraft = {
  platformName: string;
  defaultBrand: string;
  senderName: string;
  supportSessionLimit: string;
  enforceMfa: boolean;
  reportsEnabled: boolean;
};

export const PLATFORM_CONFIGURATION_STORAGE_KEY =
  "ezerx-platform-configuration-draft";
export const PLATFORM_CONFIGURATION_CHANGE_EVENT =
  "platform-configuration-change";

export const defaultPlatformConfiguration: PlatformConfigurationDraft = {
  platformName: "Acme Ops",
  defaultBrand: "#3C50E0",
  senderName: "Acme Ops",
  supportSessionLimit: "60",
  enforceMfa: true,
  reportsEnabled: true,
};

const hexPattern = /^#[0-9a-f]{6}$/i;

export function formatHexAsRgb(hex: string) {
  if (!hexPattern.test(hex)) return "Enter a valid hex value";
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
  return `RGB ${channels.join(", ")}`;
}

function normaliseDraft(
  value: Partial<PlatformConfigurationDraft>,
): PlatformConfigurationDraft {
  return {
    ...defaultPlatformConfiguration,
    ...value,
    defaultBrand: hexPattern.test(value.defaultBrand ?? "")
      ? value.defaultBrand!.toUpperCase()
      : defaultPlatformConfiguration.defaultBrand,
  };
}

export function applyPlatformConfigurationSession(
  draft: PlatformConfigurationDraft,
  root = document.documentElement,
) {
  root.style.setProperty("--primary", draft.defaultBrand);
  root.style.setProperty("--ring", draft.defaultBrand);
}

export function savePlatformConfigurationSession(
  draft: PlatformConfigurationDraft,
) {
  const next = normaliseDraft(draft);
  window.localStorage.setItem(
    PLATFORM_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(next),
  );
  applyPlatformConfigurationSession(next);
  window.dispatchEvent(
    new CustomEvent<PlatformConfigurationDraft>(
      PLATFORM_CONFIGURATION_CHANGE_EVENT,
      { detail: next },
    ),
  );
  return next;
}

export function getPlatformConfigurationSession() {
  const stored = window.localStorage.getItem(PLATFORM_CONFIGURATION_STORAGE_KEY);
  if (!stored) return null;
  try {
    return normaliseDraft(JSON.parse(stored) as Partial<PlatformConfigurationDraft>);
  } catch {
    window.localStorage.removeItem(PLATFORM_CONFIGURATION_STORAGE_KEY);
    return null;
  }
}

export function restorePlatformConfigurationSession() {
  const draft = getPlatformConfigurationSession();
  if (draft) applyPlatformConfigurationSession(draft);
  return draft;
}
