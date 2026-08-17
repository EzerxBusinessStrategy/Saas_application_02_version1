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
      <ul className="mt-4 flex flex-col gap-3">
        {tasks.map((task, index) => (
          <li key={`${task.taskType}-${index}`} className="rounded-[var(--radius-control)] border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-end gap-3 sm:col-span-2">
                <label className="flex h-10 shrink-0 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={task.enabled}
                    aria-label={`Include ${task.title || task.taskType}`}
                    onChange={(event) => update(onChange, tasks, index, { enabled: event.target.checked })}
                  />
                  <span>Include</span>
                </label>
                <label className="min-w-0 flex-1 text-sm font-medium">
                  Task
                  <Input
                    className="mt-1"
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
                </label>
              </div>
              <label className="min-w-0 text-sm font-medium">
                Frequency
                <Select
                  className="mt-1"
                  aria-label={`Frequency for ${task.title || task.taskType}`}
                  value={task.frequency}
                  onChange={(event) =>
                    update(onChange, tasks, index, {
                      frequency: event.target.value as ClientServiceDraftTask["frequency"],
                    })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Yearly</option>
                  <option value="one_time">One-time</option>
                </Select>
              </label>
              <div className="min-w-0">
                <DueRuleFields
                  frequency={task.frequency}
                  dueRule={task.dueRule}
                  onChange={(dueRule) => update(onChange, tasks, index, { dueRule })}
                />
              </div>
              <label className="min-w-0 text-sm font-medium">
                Price
                <Input
                  className="mt-1"
                  min="0"
                  step="0.01"
                  type="number"
                  value={Number.isFinite(task.rateAmount) ? task.rateAmount : 0}
                  onChange={(event) => update(onChange, tasks, index, { rateAmount: Number(event.target.value) })}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
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
