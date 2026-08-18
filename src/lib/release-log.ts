import { APP_VERSION } from "@/lib/app-version";

export type ReleaseNoteSection = "added" | "improved" | "fixed";

export type Release = {
  readonly version: string;
  readonly date: string;
  readonly title: string;
  readonly added?: readonly string[];
  readonly improved?: readonly string[];
  readonly fixed?: readonly string[];
};

export const RELEASES: readonly Release[] = [
  {
    version: APP_VERSION,
    date: "18 Aug 2026",
    title: "Initial platform release",
    added: [
      "Role-based workspaces for platform, tenant, manager, employee, and client users",
      "Dashboards with recent activity and operational overview",
      "Task lists, reviews, and a work calendar",
      "Client directory, service setup, and service requests",
      "People and teams: employees, managers, departments, and performance",
      "Agreements, invoices, and shared documents",
      "Client portal for services, deliverables, invoices, and feedback",
      "In-app notifications from the header bell",
    ],
    improved: [
      "Clearer navigation grouped by people, clients, operations, and finance",
      "Notification history includes recent read and unread items",
    ],
  },
];

export function notesForSection(
  release: Release,
  section: ReleaseNoteSection,
): readonly string[] {
  switch (section) {
    case "added":
      return release.added ?? [];
    case "improved":
      return release.improved ?? [];
    case "fixed":
      return release.fixed ?? [];
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

export function sectionLabel(section: ReleaseNoteSection): string {
  switch (section) {
    case "added":
      return "Added";
    case "improved":
      return "Improved";
    case "fixed":
      return "Fixed";
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}
