export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: INDIA_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(value));
}
