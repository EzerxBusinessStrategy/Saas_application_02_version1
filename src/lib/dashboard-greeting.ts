export type TimeOfDayGreeting = "Good morning" | "Good afternoon" | "Good evening";

export function getTimeOfDayGreeting(date = new Date()): TimeOfDayGreeting {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDashboardMonthLabel(date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}
