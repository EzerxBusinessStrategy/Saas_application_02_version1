const STORAGE_KEY = "saas-app:whats-new:seen-version";

export function readSeenReleaseVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSeenReleaseVersion(version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Viewing state is a local UX hint only.
  }
}
