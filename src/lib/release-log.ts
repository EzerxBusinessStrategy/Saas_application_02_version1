import { APP_VERSION } from "@/lib/app-version";

export type ReleaseNoteSection = "added" | "improved" | "fixed";
export type ReleaseItemTag = "New" | "Improved" | "Fixed";

export type ReleaseChangeItem = {
  readonly title: string;
  readonly description: string;
  readonly tag: ReleaseItemTag;
};

export type Release = {
  readonly version: string;
  readonly date: string;
  readonly title: string;
  readonly added?: readonly ReleaseChangeItem[];
  readonly improved?: readonly ReleaseChangeItem[];
  readonly fixed?: readonly ReleaseChangeItem[];
};

export const RELEASES: readonly Release[] = [
  {
    version: APP_VERSION,
    date: "18 Aug 2026",
    title: "Initial platform release",
    added: [
      {
        title: "Role-based workspaces",
        description: "Platform, tenant, manager, employee, and client access layers.",
        tag: "New",
      },
      {
        title: "Dashboard overview",
        description: "Operational overview and recent work visibility.",
        tag: "New",
      },
      {
        title: "Tasks and calendar",
        description: "Work tracking, task lists, reviews, and a due-date calendar.",
        tag: "New",
      },
      {
        title: "Client directory",
        description: "Client records, service setup, and service requests.",
        tag: "New",
      },
      {
        title: "People and teams",
        description: "Employees, managers, departments, and performance.",
        tag: "New",
      },
      {
        title: "Agreements and invoices",
        description: "Agreements, invoices, and shared documents.",
        tag: "New",
      },
      {
        title: "Client portal",
        description: "Services, deliverables, invoices, and feedback.",
        tag: "New",
      },
      {
        title: "In-app notifications",
        description: "Header bell with recent read and unread items.",
        tag: "New",
      },
    ],
    improved: [
      {
        title: "Navigation grouping",
        description: "Clearer grouping by people, clients, operations, and finance.",
        tag: "Improved",
      },
      {
        title: "Notification history",
        description: "Recent read and unread items in one list.",
        tag: "Improved",
      },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];

export function notesForSection(
  release: Release,
  section: ReleaseNoteSection,
): readonly ReleaseChangeItem[] {
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

export function sectionCount(release: Release, section: ReleaseNoteSection): number {
  return notesForSection(release, section).length;
}
