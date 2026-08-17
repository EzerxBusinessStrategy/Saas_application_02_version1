"use client";

import { Select } from "@/components/ui/select";
import type { ServiceOnboardingAssignee } from "@/features/administration/api/service-onboarding-api";

export function ServiceEmployeeSelector({
  serviceName,
  employees,
  value,
  isLoading,
  onChange,
}: {
  serviceName: string;
  employees: readonly ServiceOnboardingAssignee[];
  value: string;
  isLoading: boolean;
  onChange: (employeeId: string) => void;
}) {
  const selected = employees.find((employee) => employee.employeeId === value);
  const highLoad = selected ? selected.activeTasks >= 12 : false;
  return (
    <section className="rounded-[var(--radius-control)] border p-4">
      <h3 className="font-medium">{serviceName}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Who will take care of this service for the client?</p>
      <label className="mt-4 block text-sm font-medium">
        Responsible person
        <Select className="mt-1" value={value} disabled={isLoading || !employees.length} onChange={(event) => onChange(event.target.value)}>
          <option value="">{isLoading ? "Loading employees…" : "Select an employee"}</option>
          {employees.map((employee) => (
            <option key={employee.employeeId} value={employee.employeeId}>
              {employee.name}
              {employee.departmentName ? ` · ${employee.departmentName}` : ""}
              {employee.serviceCapable ? " · handles this service" : ""}
              {` · ${employee.activeTasks} active tasks · ${employee.weeklyCapacityHours}h/week`}
            </option>
          ))}
        </Select>
      </label>
      {selected ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {selected.departmentName ? `${selected.departmentName} department. ` : ""}
          {selected.serviceCapable ? "Mapped to this service." : "Not mapped to this service; still available because no specialist is set."}{" "}
          {selected.activeTasks} open tasks, {selected.weeklyCapacityHours}h weekly capacity.
        </p>
      ) : null}
      {highLoad ? (
        <p className="mt-2 text-sm text-amber-700">
          This person already has a high open-task load. You can still assign them.
        </p>
      ) : null}
      {!isLoading && !employees.length ? (
        <p className="mt-2 text-sm text-destructive">No active employees are available to assign.</p>
      ) : null}
    </section>
  );
}
