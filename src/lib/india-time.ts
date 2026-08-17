export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(value: string | Date): string {
  return formatIndiaParts(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatIndiaTimestamp(value: string | Date): string {
  return formatIndiaParts(value, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function formatIndiaParts(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    ...options,
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}
