"use client";

import { CalendarDays } from "lucide-react";
import { TaskCalendarWorkspace } from "@/components/operations/task-calendar/task-calendar-workspace";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TenantDashboardCalendarWidgetProps = {
  clientId?: string;
  employeeId?: string;
};

export function TenantDashboardCalendarWidget({
  clientId,
  employeeId,
}: TenantDashboardCalendarWidgetProps) {
  return (
    <Card>
      <CardHeader className="gap-1 border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-[18px] text-primary" aria-hidden="true" />
          Task calendar
        </CardTitle>
        <CardDescription>Plan and monitor client work and employee schedules.</CardDescription>
      </CardHeader>
      <div className="p-4 sm:p-6">
        <TaskCalendarWorkspace
          variant="embedded"
          initialClientId={clientId ?? ""}
          initialEmployeeId={employeeId ?? ""}
        />
      </div>
    </Card>
  );
}
