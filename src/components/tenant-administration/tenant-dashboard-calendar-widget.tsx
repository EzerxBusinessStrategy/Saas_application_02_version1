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
      <CardHeader className="gap-0.5 border-b px-4 py-3 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-lg leading-6">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          Task calendar
        </CardTitle>
        <CardDescription>Click a day to inspect scheduled work.</CardDescription>
      </CardHeader>
      <div className="p-3 sm:p-4">
        <TaskCalendarWorkspace
          variant="embedded"
          initialClientId={clientId ?? ""}
          initialEmployeeId={employeeId ?? ""}
        />
      </div>
    </Card>
  );
}
