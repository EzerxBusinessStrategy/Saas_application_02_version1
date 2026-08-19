"use client";

import { Select } from "@/components/ui/select";
import { specializationLabel } from "@/components/tenant-administration/employee-specialization-picker";

export function ServiceEmployeeSelector({
  serviceName,
  employees,
  value,
  isLoading,
  onChange,
  showHeading = true,
  className,
}: {
  serviceName: string;
  employees: readonly ServiceOnboardingAssignee[];
  value: string;
  isLoading: boolean;
  onChange: (employeeId: string) => void;
  showHeading?: boolean;
  className?: string;
}) {
  const selected = employees.find((employee) => employee.employeeId === value);
  const highLoad = selected ? selected.activeTasks >= 12 : false;
  return (
    <section className={cn("rounded-[var(--radius-control)] border p-4", className)}>
      {showHeading ? <h3 className="font-medium">{serviceName}</h3> : null}
      <p className={cn("text-sm text-muted-foreground", showHeading && "mt-1")}>
        Who will take care of this service for the client?
      </p>
      <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium">
        Responsible person
        <Select value={value} disabled={isLoading || !employees.length} onChange={(event) => onChange(event.target.value)}>
          <option value="">{isLoading ? "Loading employees…" : "Select an employee"}</option>
          {employees.map((employee) => (
            <option key={employee.employeeId} value={employee.employeeId}>
              {employee.name}
              {employee.departmentName ? ` · ${employee.departmentName}` : ""}
              {employee.serviceCapable ? " · specialist" : ""}
              {` · ${specializationLabel(employee.skills)}`}
              {` · ${employee.activeTasks} active tasks · ${employee.weeklyCapacityHours}h/week`}
            </option>
          ))}
        </Select>
      </label>
      {selected ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {selected.departmentName ? `${selected.departmentName} department. ` : ""}
          {selected.serviceCapable ? "Specialist for this service." : "Not a specialist for this service; still available to allocate."}{" "}
          Skills: {specializationLabel(selected.skills)}.{" "}
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
