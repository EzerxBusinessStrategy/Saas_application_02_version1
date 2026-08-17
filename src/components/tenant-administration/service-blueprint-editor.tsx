"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getServiceBlueprint,
  upsertServiceBlueprint,
  yearlyOccurrenceCount,
  type ServiceBlueprintDueRule,
  type ServiceBlueprintTask,
  type UpsertServiceBlueprintInput,
} from "@/features/administration/api/service-onboarding-api";

type DraftTask = {
  taskType: string;
  frequency: ServiceBlueprintTask["frequency"];
  dueRule: ServiceBlueprintDueRule;
  unitType: ServiceBlueprintTask["unitType"];
  rateAmount: string;
  taxCode: string;
  enabled: boolean;
};

const emptyTask = (): DraftTask => ({
  taskType: "",
  frequency: "monthly",
  dueRule: { type: "fixed_day_of_month", day: 11 },
  unitType: "per_task",
  rateAmount: "",
  taxCode: "",
  enabled: true,
});

export function ServiceBlueprintEditor({
  service,
  onOpenChange,
  onSaved,
}: {
  service: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = Boolean(service);
  const query = useQuery({
    queryKey: ["tenant-admin-service-blueprint", service?.id],
    queryFn: () => getServiceBlueprint(service!.id),
    enabled: open,
  });
  const [countryCode, setCountryCode] = useState("IN");
  const [currencyCode, setCurrencyCode] = useState<"INR" | "USD" | "GBP">("INR");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setCountryCode(query.data.countryCode || "IN");
    setCurrencyCode(query.data.currencyCode === "USD" || query.data.currencyCode === "GBP" ? query.data.currencyCode : "INR");
    setTasks(
      query.data.tasks.length
        ? query.data.tasks.map((task) => ({
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            unitType: task.unitType,
            rateAmount: String(task.rateAmount),
            taxCode: task.taxCode ?? "",
            enabled: task.enabled,
          }))
        : [emptyTask()],
    );
  }, [query.data]);

  const estimatedTotal = tasks.reduce((sum, task) => {
    const amount = Number(task.rateAmount);
    if (!task.enabled || !Number.isFinite(amount) || amount < 0) return sum;
    return sum + amount * yearlyOccurrenceCount(task.frequency);
  }, 0);
  const canSave =
    tasks.length > 0 &&
    tasks.every((task) => task.taskType.trim().length >= 2 && Number.isFinite(Number(task.rateAmount)) && Number(task.rateAmount) >= 0);

  const save = async () => {
    if (!service || !canSave) return;
    setSaving(true);
    try {
      const input: UpsertServiceBlueprintInput = {
        countryCode,
        currencyCode,
        effectiveFrom,
        tasks: tasks.map((task) => ({
          taskType: task.taskType.trim(),
          frequency: task.frequency,
          dueRule: dueRuleForFrequency(task.frequency, task.dueRule),
          unitType: task.unitType,
          rateAmount: Number(task.rateAmount),
          taxCode: task.taxCode.trim(),
          enabled: task.enabled,
        })),
      };
      await upsertServiceBlueprint(service.id, input);
      toast.success("Service tasks saved. Existing clients keep their current package.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Service tasks could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Manage tasks for ${service?.name ?? "service"}`}
        description="Define the reusable booklet of tasks, recurrence, due rules, and default prices. Client packages already activated stay unchanged."
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-semibold">Manage tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {service?.name}. These are tenant defaults. Activated clients keep their saved snapshot.
          </p>
          {query.isPending ? <p className="mt-5 text-sm text-muted-foreground">Loading service tasks…</p> : null}
          {query.isError ? (
            <p className="mt-5 text-sm text-destructive">Service tasks could not load. Close and try again.</p>
          ) : null}
          {query.data ? (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium">
                  Country
                  <Input className="mt-1" maxLength={2} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} />
                </label>
                <label className="text-sm font-medium">
                  Currency
                  <Select className="mt-1" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value as "INR" | "USD" | "GBP")}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </Select>
                </label>
                <label className="text-sm font-medium">
                  Effective from
                  <Input className="mt-1" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
                </label>
              </div>
              <ul className="mt-5 flex flex-col gap-4">
                {tasks.map((task, index) => (
                  <li key={`${task.taskType}-${index}`} className="rounded-[var(--radius-control)] border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium sm:col-span-2">
                        Task
                        <Input
                          className="mt-1"
                          value={task.taskType}
                          onChange={(event) => updateTask(setTasks, index, { taskType: event.target.value })}
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Frequency
                        <Select
                          className="mt-1"
                          value={task.frequency}
                          onChange={(event) => {
                            const frequency = event.target.value as DraftTask["frequency"];
                            updateTask(setTasks, index, {
                              frequency,
                              dueRule: dueRuleForFrequency(frequency, task.dueRule),
                            });
                          }}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Yearly</option>
                          <option value="one_time">One-time</option>
                        </Select>
                      </label>
                      <DueRuleFields
                        frequency={task.frequency}
                        dueRule={task.dueRule}
                        onChange={(dueRule) => updateTask(setTasks, index, { dueRule })}
                      />
                      <label className="text-sm font-medium">
                        Billing unit
                        <Select
                          className="mt-1"
                          value={task.unitType}
                          onChange={(event) => updateTask(setTasks, index, { unitType: event.target.value as DraftTask["unitType"] })}
                        >
                          <option value="per_task">Per task</option>
                          <option value="per_hour">Per hour</option>
                          <option value="per_filing">Per filing</option>
                          <option value="per_unit">Per unit</option>
                        </Select>
                      </label>
                      <label className="text-sm font-medium">
                        Default price
                        <Input
                          className="mt-1"
                          min="0"
                          step="0.01"
                          type="number"
                          value={task.rateAmount}
                          onChange={(event) => updateTask(setTasks, index, { rateAmount: event.target.value })}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={tasks.length === 1}
                        onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))}
                      >
                        <Trash2 data-icon="inline-start" className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" className="mt-4" onClick={() => setTasks((current) => [...current, emptyTask()])}>
                <Plus data-icon="inline-start" />
                Add task
              </Button>
              <p className="mt-4 text-sm font-medium">Estimated annual total {formatMoney(estimatedTotal, currencyCode)}</p>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving || !canSave} onClick={() => void save()}>
                  {saving ? "Saving..." : "Save service tasks"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DueRuleFields({
  frequency,
  dueRule,
  onChange,
}: {
  frequency: ServiceBlueprintTask["frequency"];
  dueRule: ServiceBlueprintDueRule;
  onChange: (dueRule: ServiceBlueprintDueRule) => void;
}) {
  if (frequency === "one_time") {
    return (
      <label className="grid gap-1">
        <span className="text-sm font-medium">Due date</span>
        <Input
          type="date"
          value={dueRule.date ?? ""}
          onChange={(event) => onChange({ type: "fixed_month_day", date: event.target.value })}
        />
      </label>
    );
  }
  if (frequency === "annually") {
    return (
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Due month</span>
          <Input
            max={12}
            min={1}
            type="number"
            value={dueRule.month ?? 3}
            onChange={(event) => onChange({ type: "fixed_month_day", month: Number(event.target.value), day: dueRule.day ?? 31 })}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Due day</span>
          <Input
            max={31}
            min={1}
            type="number"
            value={dueRule.day ?? 31}
            onChange={(event) => onChange({ type: "fixed_month_day", month: dueRule.month ?? 3, day: Number(event.target.value) })}
          />
        </label>
      </div>
    );
  }
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium">Due day of month</span>
      <Input
        max={31}
        min={1}
        type="number"
        value={dueRule.day ?? (frequency === "quarterly" ? 15 : 11)}
        onChange={(event) =>
          onChange({
            type: frequency === "quarterly" ? "quarterly_due_date" : "fixed_day_of_month",
            day: Number(event.target.value),
          })
        }
      />
    </label>
  );
}

function dueRuleForFrequency(
  frequency: ServiceBlueprintTask["frequency"],
  current: ServiceBlueprintDueRule,
): ServiceBlueprintDueRule {
  switch (frequency) {
    case "monthly":
      return { type: "fixed_day_of_month", day: current.day ?? 11 };
    case "quarterly":
      return { type: "quarterly_due_date", day: current.day ?? 15 };
    case "annually":
      return { type: "fixed_month_day", month: current.month ?? 3, day: current.day ?? 31 };
    case "one_time":
      return { type: "fixed_month_day", date: current.date ?? new Date().toISOString().slice(0, 10) };
    default: {
      const exhaustive: never = frequency;
      return exhaustive;
    }
  }
}

function updateTask(setTasks: Dispatch<SetStateAction<DraftTask[]>>, index: number, patch: Partial<DraftTask>) {
  setTasks((current) => current.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task)));
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
