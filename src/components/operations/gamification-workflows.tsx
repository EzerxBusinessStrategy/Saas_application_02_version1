"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  Eye,
  MessageSquare,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createRecognition,
  getGamificationWorkspace,
  saveGamificationPreferences,
  saveGamificationTenantPolicy,
  updateDeliverableReview,
} from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  recognitionInputSchema,
  type RecognitionInput,
} from "@/types/operations";
import type { Workspace } from "@/types/domain";

type GamificationData = Awaited<ReturnType<typeof getGamificationWorkspace>>;

function useGamification(workspace: Workspace) {
  return useQuery({
    queryKey: ["gamification", workspace],
    queryFn: () => getGamificationWorkspace(workspace),
  });
}

function CompletionRing({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label: string;
}) {
  const percent = target
    ? Math.min(100, Math.round((current / target) * 100))
    : 0;
  return (
    <div className="flex items-center gap-4">
      <svg
        className="size-20 -rotate-90"
        viewBox="0 0 36 36"
        role="img"
        aria-label={`${label}: ${current} of ${target}, ${percent}%`}
      >
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-muted"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${percent} 100`}
          strokeLinecap="round"
          className="text-primary"
        />
        <text
          x="18"
          y="20"
          textAnchor="middle"
          className="fill-foreground text-[8px] rotate-90 origin-center"
        >
          {percent}%
        </text>
      </svg>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {current} of {target} scheduled days completed
        </p>
      </div>
    </div>
  );
}

export function DailyProgress({ data }: { data: GamificationData }) {
  const { daily, consistency, comparisons } = data;
  const remaining = Math.max(0, daily.plannedTasks - daily.completedTasks);
  return (
    <section
      className="grid gap-[30px] lg:grid-cols-2"
      aria-label="Daily progress"
    >
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s progress</CardTitle>
          <CardDescription>
            Delivery visibility supports quality work; it does not reward
            overtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CompletionRing
            current={daily.completedTasks}
            target={daily.plannedTasks}
            label="Daily task goal"
          />
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <strong>{remaining}</strong> tasks remaining today
            </p>
            <p>
              <strong>{daily.overdueTasks}</strong> overdue tasks in your
              assigned scope
            </p>
            <p>
              <strong>{daily.completedWithinSla}</strong> completed within SLA
            </p>
            <p>
              <strong>
                {Math.floor(daily.loggedMinutes / 60)}h{" "}
                {daily.loggedMinutes % 60}m
              </strong>{" "}
              logged today
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {daily.workLogComplete
              ? "Today’s work log is complete."
              : "Today’s work log still needs submission."}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Next milestone</CardTitle>
          <CardDescription>
            Use your current schedule to plan the next authorised delivery step.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="font-medium">
            {daily.nextMilestone ?? "No upcoming milestone"}
          </p>
          <p className="text-sm text-muted-foreground">
            Weekly preview: {consistency.completedDays} of{" "}
            {consistency.scheduledDays} scheduled workdays have a submitted or
            reviewed work log.
          </p>
        </CardContent>
      </Card>
      {data.policy.enabled && data.preferences.personalComparison ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal comparison</CardTitle>
            <CardDescription>
              Compare your own recent delivery period with the previous one. It
              is private feedback, not a performance ranking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4 sm:grid-cols-3">
              {comparisons.map((comparison) => {
                const change = comparison.current - comparison.previous;
                const changeLabel =
                  change > 0
                    ? `Up ${change}`
                    : change < 0
                      ? `Down ${Math.abs(change)}`
                      : "No change";
                return (
                  <li key={comparison.label}>
                    <p className="text-sm font-medium">{comparison.label}</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {comparison.current}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {changeLabel} from {comparison.previous} last period
                    </p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export function WorkLogConsistency({ data }: { data: GamificationData }) {
  const { consistency, preferences, policy } = data;
  if (!policy.enabled || !policy.consistency || !preferences.consistencyStreak)
    return (
      <DisabledState
        title="Consistency tracking is unavailable"
        description="Your organisation or personal preferences currently hide consistency tracking."
      />
    );
  return (
    <section className="grid gap-[30px] lg:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Weekly work-log completion</CardTitle>
          <CardDescription>
            Scheduled days only · {consistency.timezone}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CompletionRing
            current={consistency.completedDays}
            target={consistency.scheduledDays}
            label="Work-log completion"
          />
          <p className="text-sm text-muted-foreground">
            {consistency.missingDays
              ? `${consistency.missingDays} work-log entry is missing.`
              : "Work logs are complete for all scheduled days this week."}
          </p>
          <p className="text-sm text-muted-foreground">
            {consistency.approvedLeaveDays} approved leave day and{" "}
            {consistency.holidayDays} holiday day are excluded.{" "}
            {consistency.rejectedDays
              ? `${consistency.rejectedDays} entry needs resubmission.`
              : ""}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Missing-entry checklist</CardTitle>
          <CardDescription>
            Dates are shown in your configured IANA timezone. Leave, holidays,
            and non-working days never count as missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consistency.days.length ? (
            <ul className="flex flex-col divide-y">
              {consistency.days.map((day) => (
                <li
                  key={day.date}
                  className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {day.date} · {day.expected.replaceAll("-", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {day.task ?? "No task required"}
                      {day.feedback ? ` · ${day.feedback}` : ""}
                    </p>
                  </div>
                  <Badge
                    tone={
                      day.current === "missing" || day.current === "rejected"
                        ? "warning"
                        : day.current === "not-required"
                          ? "neutral"
                          : "success"
                    }
                  >
                    {day.current.replaceAll("-", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No scheduled days"
              description="Your working calendar has no scheduled days in this period."
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function AchievementCatalogue() {
  const query = useGamification("employee");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<
    GamificationData["achievements"][number] | null
  >(null);
  if (query.isPending)
    return <LoadingState label="Loading achievements" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Achievements could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (
    !data.policy.enabled ||
    !data.policy.achievements ||
    !data.preferences.achievementCatalogue
  )
    return (
      <DisabledState
        title="Achievements are unavailable"
        description="Your organisation or personal preferences have disabled the catalogue."
      />
    );
  const items = data.achievements.filter((item) =>
    filter === "all" || filter === "unlocked"
      ? filter === "all" || item.unlocked
      : !item.unlocked,
  );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Achievements"
        description="Private milestones based on authorised work. Verification remains pending until the backend is connected."
      />
      <ResponsiveTabs
        label="Achievement filters"
        value={filter}
        onValueChange={setFilter}
        tabs={[
          { value: "all", label: "All" },
          { value: "unlocked", label: "Unlocked" },
          { value: "locked", label: "Locked" },
        ]}
      >
        <section className="grid gap-5 md:grid-cols-2">
          {items.map((item) => {
            const progress = data.achievementProgress.find(
              (value) => value.achievementId === item.id,
            );
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                    <Badge tone={item.unlocked ? "success" : "neutral"}>
                      {item.unlocked ? "Unlocked" : "Locked"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.requirement}
                  </p>
                  {progress ? (
                    <p className="mt-3 text-sm">
                      Progress: {progress.current} of {progress.target}
                    </p>
                  ) : null}
                  <Button
                    className="mt-4"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(item)}
                  >
                    <Eye data-icon="inline-start" />
                    View details
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </ResponsiveTabs>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent title="Achievement details">
          <div className="pr-8">
            <h2 className="font-semibold">{selected?.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {selected?.requirement}
            </p>
            <p className="mt-3 text-sm">
              Visibility: {selected?.visibility} ·{" "}
              {selected?.verification.replaceAll("-", " ")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecognitionFeed({
  items,
  employee = false,
}: {
  items: GamificationData["recognitions"];
  employee?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {employee ? "Recognition received" : "Recognition history"}
        </CardTitle>
        <CardDescription>
          Recognition is qualitative feedback, not an employee score.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="flex flex-col divide-y">
            {items.map((item) => (
              <li key={item.id} className="py-4 first:pt-0">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">
                    {item.recipient}
                    {employee ? "" : ` · ${item.category.replaceAll("-", " ")}`}
                  </p>
                  <Badge tone="info">
                    {item.visibility.replaceAll("-", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  From {item.from} · {item.date}
                  {item.relatedWork ? ` · ${item.relatedWork}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No recognition yet"
            description="Meaningful delivery feedback will appear here when it is shared with you."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function EmployeeRecognition() {
  const query = useGamification("employee");
  if (query.isPending)
    return <LoadingState label="Loading recognition" rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        title="Recognition could not load"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Recognition"
        description="Private or permitted recognition from your delivery work."
      />
      <RecognitionFeed items={query.data.recognitions} employee />
    </div>
  );
}

export function ManagerRecognition() {
  const query = useGamification("manager");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<RecognitionInput>({
    resolver: zodResolver(recognitionInputSchema),
    defaultValues: {
      recipient: "Riley Shah",
      recipientType: "employee",
      category: "quality-work",
      message: "",
      relatedWork: "GST Filing",
      privateNote: "",
      visibility: "manager-recipient",
      notifyRecipient: true,
    },
  });
  const mutation = useMutation({
    mutationFn: createRecognition,
    onSuccess: ({ duplicate }) => {
      void client.invalidateQueries({ queryKey: ["gamification", "manager"] });
      setOpen(false);
      toast(
        duplicate
          ? "Matching recognition already exists in this mock session."
          : "Recognition recorded for this mock session.",
      );
    },
    onError: () => toast.error("Recognition could not be recorded."),
  });
  if (query.isPending)
    return <LoadingState label="Loading recognition" rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        title="Recognition could not load"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Manager"
        title="Recognition"
        description="Recognise quality, collaboration, and delivery milestones in your assigned scope."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Award data-icon="inline-start" />
            Recognise work
          </Button>
        }
      />
      <RecognitionFeed items={query.data.recognitions} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Create recognition"
          description="Records a recognition item in the current mock session only."
        >
          <form
            className="flex flex-col gap-4 pr-8"
            onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
          >
            <h2 className="font-semibold">Create recognition</h2>
            <label className="text-sm font-medium">
              Recipient
              <Input className="mt-1" {...form.register("recipient")} />
            </label>
            <label className="text-sm font-medium">
              Recipient type
              <Select className="mt-1" {...form.register("recipientType")}>
                <option value="employee">Employee</option>
                <option value="work-group">Work group</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Category
              <Select className="mt-1" {...form.register("category")}>
                <option value="quality-work">Quality work</option>
                <option value="timely-delivery">Timely delivery</option>
                <option value="collaboration">Collaboration</option>
                <option value="client-support">Client support</option>
                <option value="process-improvement">Process improvement</option>
                <option value="learning">Learning</option>
                <option value="milestone-completion">
                  Milestone completion
                </option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Reason
              <textarea
                className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm"
                aria-invalid={Boolean(form.formState.errors.message)}
                {...form.register("message")}
              />
              {form.formState.errors.message ? (
                <span className="text-xs text-danger">
                  {form.formState.errors.message.message}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium">
              Related work (optional)
              <Input className="mt-1" {...form.register("relatedWork")} />
            </label>
            <label className="text-sm font-medium">
              Private manager note (optional)
              <textarea
                className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm"
                {...form.register("privateNote")}
              />
            </label>
            <label className="text-sm font-medium">
              Visibility
              <Select className="mt-1" {...form.register("visibility")}>
                <option value="private">Private to recipient</option>
                <option value="manager-recipient">Manager and recipient</option>
                <option value="team">Team</option>
              </Select>
            </label>
            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...form.register("notifyRecipient")}
              />
              <span>Notify recipient</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Recording…" : "Record recognition"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmployeePreferences() {
  const query = useGamification("employee");
  const client = useQueryClient();
  const form = useForm({
    defaultValues: {
      enabled: true,
      achievementNotifications: true,
      achievementCatalogue: true,
      consistencyStreak: true,
      personalComparison: true,
      celebrationAnimation: false,
      keepAchievementsPrivate: true,
      recognitionNotifications: true,
      teamRecognitionFeed: true,
      reducedMotion: false,
    },
  });
  const mutation = useMutation({
    mutationFn: saveGamificationPreferences,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["gamification"] });
      toast.success("Preferences saved for this mock session.");
    },
  });
  if (query.isPending)
    return <LoadingState label="Loading preferences" rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        title="Preferences could not load"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Progress preferences"
        description="Choose what private progress feedback you see. Organisation policy can apply stricter limits."
      />
      <Card>
        <CardHeader>
          <CardTitle>Personal visibility</CardTitle>
          <CardDescription>
            These settings are retained only for this mock session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
          >
            {[
              ["achievementNotifications", "Show achievement notifications"],
              ["achievementCatalogue", "Show achievement catalogue"],
              ["consistencyStreak", "Show consistency tracking"],
              ["personalComparison", "Show personal comparison"],
              ["keepAchievementsPrivate", "Keep achievements private"],
              ["recognitionNotifications", "Receive recognition notifications"],
              ["teamRecognitionFeed", "Show permitted team recognition"],
              ["reducedMotion", "Reduce motion"],
            ].map(([name, label]) => (
              <label key={name} className="flex gap-3 text-sm">
                <input
                  className="size-4 accent-primary"
                  type="checkbox"
                  {...form.register(
                    name as keyof typeof query.data.preferences,
                  )}
                />
                <span>{label}</span>
              </label>
            ))}
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save preferences"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function TenantGamificationSettings() {
  const query = useGamification("admin");
  const client = useQueryClient();
  const form = useForm({
    defaultValues: {
      enabled: true,
      achievements: true,
      consistency: true,
      managerRecognition: true,
      teamFeed: true,
      tenantFeed: false,
      clientOnboarding: true,
      serviceMilestones: true,
      celebrationAnimation: false,
      defaultVisibility: "private" as const,
      timezone: "Asia/Kolkata",
      workingDays: [1, 2, 3, 4, 5],
      leaveIntegration: "pending" as const,
    },
  });
  const mutation = useMutation({
    mutationFn: saveGamificationTenantPolicy,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["gamification"] });
      toast.success("Tenant policy saved for this mock session.");
    },
  });
  if (query.isPending)
    return <LoadingState label="Loading gamification settings" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Gamification settings could not load"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Gamification settings"
        description="Set optional progress and recognition rules. Backend policy enforcement is required before live use."
      />
      <Card>
        <CardHeader>
          <CardTitle>Tenant policy</CardTitle>
          <CardDescription>
            These controls do not rank employees or make progress mandatory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
          >
            {[
              ["enabled", "Enable professional progress"],
              ["achievements", "Enable personal achievements"],
              ["consistency", "Enable consistency tracking"],
              ["managerRecognition", "Enable manager recognition"],
              ["teamFeed", "Enable team recognition feed"],
              ["tenantFeed", "Enable tenant recognition feed"],
              ["clientOnboarding", "Enable client onboarding progress"],
              ["serviceMilestones", "Enable service milestones"],
              ["celebrationAnimation", "Allow restrained celebration feedback"],
            ].map(([name, label]) => (
              <label key={name} className="flex gap-3 text-sm">
                <input
                  className="size-4 accent-primary"
                  type="checkbox"
                  {...form.register(name as keyof typeof query.data.policy)}
                />
                <span>{label}</span>
              </label>
            ))}
            <label className="text-sm font-medium">
              Tenant timezone
              <Select className="mt-1" {...form.register("timezone")}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New York</option>
              </Select>
            </label>
            <p className="text-sm text-muted-foreground md:col-span-2">
              Working days, holidays, approved leave, and duplicate achievement
              awards require backend-authoritative data. Leave integration:{" "}
              {query.data.policy.leaveIntegration}.
            </p>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                <Settings2 data-icon="inline-start" />
                {mutation.isPending ? "Saving…" : "Save tenant policy"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Client onboarding progress</CardTitle>
          <CardDescription>
            Internal and client-visible setup steps for the current tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {query.data.onboarding.map((step) => (
              <li
                key={step.id}
                className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.owner} {step.dueDate ? `- due ${step.dueDate}` : ""}
                    {step.clientVisible ? " - client visible" : " - internal"}
                  </p>
                </div>
                <Badge
                  tone={step.status === "completed" ? "success" : "neutral"}
                >
                  {step.status.replaceAll("-", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DisabledState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <EmptyState title={title} description={description} />;
}

export function ClientOnboarding() {
  const query = useGamification("client");
  if (query.isPending)
    return <LoadingState label="Loading onboarding progress" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Onboarding progress could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const steps = query.data.onboarding;
  const completed = steps.filter((step) => step.status === "completed").length;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Onboarding"
        description="Complete the client-facing steps needed to begin service delivery."
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {completed} of {steps.length} onboarding steps completed
          </CardTitle>
          <CardDescription>
            Internal team-only setup is not shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Responsible: {step.owner}
                    {step.dueDate ? ` · due ${step.dueDate}` : ""}
                  </p>
                </div>
                <Badge
                  tone={
                    step.status === "completed"
                      ? "success"
                      : step.status === "blocked"
                        ? "danger"
                        : "warning"
                  }
                >
                  {step.status.replaceAll("-", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientDeliverables() {
  const query = useGamification("client");
  const client = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const mutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "request-changes";
    }) => updateDeliverableReview(id, action, feedback),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["gamification", "client"] });
      setFeedback("");
      toast.success("Deliverable decision recorded for this mock session.");
    },
  });
  if (query.isPending)
    return <LoadingState label="Loading deliverables" rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        title="Deliverables could not load"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Deliverables"
        description="Review authorised delivery files, feedback, and revision history."
      />
      <div className="flex flex-col gap-[30px]">
        {query.data.deliverables.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex justify-between gap-3">
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>
                    Due {item.dueDate} · {item.nextAction}
                  </CardDescription>
                </div>
                <Badge tone={item.status === "approved" ? "success" : "info"}>
                  {item.status.replaceAll("-", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm">
                <strong>Attachment:</strong> {item.attachments.join(", ")}
              </p>
              <p className="text-sm">
                <strong>Revision history:</strong>{" "}
                {item.revisions.map((revision) => revision.label).join(", ")}
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                {item.clientFeedback.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.author}:</strong> {entry.message}
                  </li>
                ))}
              </ul>
              {item.status !== "approved" ? (
                <>
                  <label className="text-sm font-medium">
                    Feedback or requested changes
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm"
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        mutation.mutate({ id: item.id, action: "approve" })
                      }
                      disabled={mutation.isPending}
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      Approve deliverable
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        mutation.mutate({
                          id: item.id,
                          action: "request-changes",
                        })
                      }
                      disabled={
                        mutation.isPending || feedback.trim().length < 5
                      }
                    >
                      <MessageSquare data-icon="inline-start" />
                      Request changes
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
