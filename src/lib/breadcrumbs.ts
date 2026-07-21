import { flattenNavigation, navigationFor } from "@/lib/nav";
import { hasAnyPermission } from "@/lib/permissions";
import type { Role, Workspace } from "@/types/domain";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

const workspaceLabels: Record<Workspace, string> = {
  "super-admin": "Platform",
  admin: "Tenant administration",
  manager: "Manager",
  employee: "Employee",
  client: "Client portal",
};

const titleCase = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function breadcrumbsFor({
  pathname,
  workspace,
  role,
}: {
  pathname: string;
  workspace: Workspace;
  role: Role;
}): BreadcrumbItem[] {
  const parts = pathname.split("/").filter(Boolean);
  const workspaceHref = `/${workspace}`;
  const result: BreadcrumbItem[] = [
    { label: workspaceLabels[workspace], href: workspaceHref },
  ];
  const section = parts[1];

  if (!section) {
    result[0].current = true;
    delete result[0].href;
    return result;
  }

  const item = flattenNavigation(navigationFor(workspace)).find(
    (navigationItem) => navigationItem.href === `/${section}`,
  );
  if (!item || !hasAnyPermission(role, item.permissions)) {
    return result;
  }

  result.push({ label: item.label, href: `${workspaceHref}/${section}` });
  const entity = parts[2];
  if (entity) {
    result.push({ label: titleCase(entity), current: true });
  } else {
    result[1].current = true;
    delete result[1].href;
  }
  return result;
}
