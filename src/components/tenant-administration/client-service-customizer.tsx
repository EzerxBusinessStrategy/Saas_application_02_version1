"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DueRuleFields } from "@/components/tenant-administration/service-blueprint-editor";
import {
  estimatedServiceTotal,
  type ServiceBlueprintDueRule,
  type ServiceBlueprintTask,
} from "@/features/administration/api/service-onboarding-api";

export type ClientServiceDraftTask = {
  taskType: string;
  title: string;
  frequency: ServiceBlueprintTask["frequency"];
  dueRule: ServiceBlueprintDueRule;
  unitType: ServiceBlueprintTask["unitType"];
  rateAmount: number;
  taxCode: string;
  enabled: boolean;
  isCustom?: boolean;
};

export function ClientServiceCustomizer({
  serviceName,
  currencyCode,
  tasks,
  onChange,
  description = "Changes apply to this client only.",
}: {
  serviceName: string;
  currencyCode: string;
  tasks: readonly ClientServiceDraftTask[];
  onChange: (tasks: ClientServiceDraftTask[]) => void;
  description?: string;
}) {
  const estimated = estimatedServiceTotal(tasks);
  return (
    <section className="rounded-[var(--radius-control)] border p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-medium">{serviceName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-sm font-medium">{formatMoney(estimated, currencyCode)}</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Include</th>
              <th className="py-2 pr-3 font-medium">Task</th>
              <th className="py-2 pr-3 font-medium">Frequency</th>
              <th className="py-2 pr-3 font-medium">Due</th>
              <th className="py-2 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, index) => (
              <tr key={`${task.taskType}-${index}`} className="border-t align-top">
                <td className="py-3 pr-3">
                  <input
                    type="checkbox"
                    checked={task.enabled}
                    aria-label={`Include ${task.title || task.taskType}`}
                    onChange={(event) => update(onChange, tasks, index, { enabled: event.target.checked })}
                  />
                </td>
                <td className="py-3 pr-3">
                    <Input
                    value={task.title || task.taskType}
                    onChange={(event) =>
                      update(
                        onChange,
                        tasks,
                        index,
                        task.isCustom
                          ? { title: event.target.value, taskType: event.target.value }
                          : { title: event.target.value },
                      )
                    }
                  />
                </td>
                <td className="py-3 pr-3">
                  <Select
                    value={task.frequency}
                    onChange={(event) =>
                      update(onChange, tasks, index, { frequency: event.target.value as ClientServiceDraftTask["frequency"] })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Yearly</option>
                    <option value="one_time">One-time</option>
                  </Select>
                </td>
                <td className="py-3 pr-3 min-w-40">
                  <DueRuleFields
                    frequency={task.frequency}
                    dueRule={task.dueRule}
                    onChange={(dueRule) => update(onChange, tasks, index, { dueRule })}
                  />
                </td>
                <td className="py-3">
                  <label className="sr-only">Price for {task.taskType}</label>
                  <Input
                    min="0"
                    step="0.01"
                    type="number"
                    value={task.rateAmount}
                    onChange={(event) => update(onChange, tasks, index, { rateAmount: Number(event.target.value) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() =>
          onChange([
            ...tasks,
            {
              taskType: "Additional task",
              title: "Additional task",
              frequency: "one_time",
              dueRule: { type: "fixed_month_day", date: new Date().toISOString().slice(0, 10) },
              unitType: "per_task",
              rateAmount: 0,
              taxCode: "",
              enabled: true,
              isCustom: true,
            },
          ])
        }
      >
        <Plus data-icon="inline-start" />
        Add task
      </Button>
      <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Pencil className="size-3.5" aria-hidden="true" />
        Tenant defaults stay unchanged when you edit this booklet.
      </p>
    </section>
  );
}

function update(
  onChange: (tasks: ClientServiceDraftTask[]) => void,
  tasks: readonly ClientServiceDraftTask[],
  index: number,
  patch: Partial<ClientServiceDraftTask>,
) {
  onChange(tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task)));
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
