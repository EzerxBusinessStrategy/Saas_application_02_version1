import { tenantBrandingDraftSchema, type TenantBrandingDraft } from "@/types/administration";

export const TENANT_BRANDING_STORAGE_PREFIX = "ezerx-tenant-branding-draft";
export const TENANT_BRANDING_CHANGE_EVENT = "tenant-branding-change";

export function tenantBrandingStorageKey(tenantId: string) {
  return `${TENANT_BRANDING_STORAGE_PREFIX}:${tenantId}`;
}

const fontFamilies: Record<TenantBrandingDraft["headingFont"], string> = {
  System: "system-ui, sans-serif",
  Arial: "Arial, sans-serif",
  Georgia: "Georgia, serif",
  Verdana: "Verdana, sans-serif",
  Trebuchet: "'Trebuchet MS', sans-serif",
};

const densityPadding: Record<TenantBrandingDraft["density"], string> = {
  compact: "1rem",
  comfortable: "1.5rem",
  relaxed: "2rem",
  spacious: "2.5rem",
};

export function tenantBrandingFontFamily(font: TenantBrandingDraft["headingFont"]) {
  return fontFamilies[font];
}

export function applyTenantBrandingSession(draft: TenantBrandingDraft, root = document.documentElement) {
  root.style.setProperty("--primary", draft.primaryColour);
  root.style.setProperty("--ring", draft.primaryColour);
  root.style.setProperty("--sidebar", draft.sidebarColour);
  root.style.setProperty("--sidebar-background", draft.sidebarColour);
  root.style.setProperty("--surface-elevated", draft.surfaceColour);
  root.style.setProperty("--tenant-font-family", tenantBrandingFontFamily(draft.headingFont));
  root.style.setProperty("--tenant-main-padding-y", densityPadding[draft.density]);
  root.dataset.tenantDensity = draft.density;

  if (draft.defaultTheme === "dark") root.classList.add("dark");
  if (draft.defaultTheme === "light") root.classList.remove("dark");
}

export function saveTenantBrandingSession(
  tenantId: string,
  draft: TenantBrandingDraft,
) {
  window.localStorage.setItem(
    tenantBrandingStorageKey(tenantId),
    JSON.stringify(draft),
  );
  applyTenantBrandingSession(draft);
  window.dispatchEvent(
    new CustomEvent<{ tenantId: string; draft: TenantBrandingDraft }>(
      TENANT_BRANDING_CHANGE_EVENT,
      { detail: { tenantId, draft } },
    ),
  );
}

export function getTenantBrandingSession(tenantId: string) {
  const key = tenantBrandingStorageKey(tenantId);
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = tenantBrandingDraftSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function restoreTenantBrandingSession(tenantId: string) {
  const draft = getTenantBrandingSession(tenantId);
  if (draft) applyTenantBrandingSession(draft);
  return draft;
}
