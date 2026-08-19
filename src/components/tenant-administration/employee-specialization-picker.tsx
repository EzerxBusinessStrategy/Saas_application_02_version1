"use client";

import type { TenantAdminService } from "@/features/operations/api/operations-api";

export function EmployeeSpecializationPicker({
  services,
  selectedIds,
  isLoading,
  onChange,
}: {
  services: readonly TenantAdminService[];
  selectedIds: readonly string[];
  isLoading: boolean;
  onChange: (serviceIds: string[]) => void;
}) {
  const activeServices = services.filter((service) => service.status === "active");
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Skills / specialization</legend>
      <p className="text-xs text-muted-foreground">
        Map this employee to the services they handle. Leave empty to keep them available for any task allocation.
      </p>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--radius-control)] border border-input bg-muted/20 p-2">
        {activeServices.length ? (
          activeServices.map((service) => (
            <label key={service.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={selectedIds.includes(service.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...new Set([...selectedIds, service.id])]
                      : selectedIds.filter((id) => id !== service.id),
                  )
                }
              />
              <span className="min-w-0 flex-1 truncate">{service.name}</span>
            </label>
          ))
        ) : (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            {isLoading ? "Loading services…" : "Create services first, then map the ones this employee specializes in."}
          </p>
        )}
      </div>
    </fieldset>
  );
}

export function specializationLabel(skills: readonly string[]): string {
  return skills.length ? skills.join(", ") : "No specialization";
}

export function employeesForServiceAllocation<T extends { name: string; skills: readonly string[] }>(
  employees: readonly T[],
  serviceName: string,
): T[] {
  const needle = serviceName.trim().toLowerCase();
  return [...employees].sort((left, right) => {
    const leftMatch = needle ? left.skills.some((skill) => skill.toLowerCase() === needle) : false;
    const rightMatch = needle ? right.skills.some((skill) => skill.toLowerCase() === needle) : false;
    if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}
