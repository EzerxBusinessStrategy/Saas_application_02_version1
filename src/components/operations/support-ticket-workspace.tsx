"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleHelp,
  FileUp,
  MessageSquare,
  Send,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignSupportTicket,
  createSupportTicket,
  listSupportTickets,
  replyToSupportTicket,
  resolveSupportTicket,
} from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SupportTicket, SupportTicketInput } from "@/types/operations";

type TicketWorkspace = "client" | "manager" | "admin";

const draftStorageKey = "support-ticket-draft:northstar";
const maxAttachments = 5;
const maxAttachmentBytes = 20 * 1024 * 1024;
const supportedAttachmentExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
  "docx",
  "xlsx",
  "csv",
  "mp4",
  "txt",
  "log",
]);
const employees = [
  { id: "emp-riley", name: "Riley Shah" },
  { id: "emp-aarav", name: "Aarav Mehta" },
  { id: "emp-zoe", name: "Zoe Martin" },
];
const serviceCategories = {
  "GST Filing": [
    ["filing-submission", "Filing or submission issue"],
    ["document-evidence", "Document or evidence request"],
    ["payment-invoice", "Payment or invoice query"],
    ["report-certificate", "Report or certificate request"],
    ["incorrect-information", "Incorrect information"],
    ["account-access", "Account or access issue"],
    ["deadline-clarification", "Deadline clarification"],
    ["technical-problem", "Technical problem"],
    ["service-delivery", "Service delivery question"],
    ["general-enquiry", "General enquiry"],
    ["other", "Other"],
  ],
  "Compliance Review": [
    ["document-evidence", "Document or evidence request"],
    ["incorrect-information", "Incorrect information"],
    ["deadline-clarification", "Deadline clarification"],
    ["service-delivery", "Status and delivery timeline"],
    ["general-enquiry", "General enquiry"],
    ["other", "Other"],
  ],
  "Accounts support": [
    ["payment-invoice", "Payment or invoice query"],
    ["report-certificate", "Report or certificate request"],
    ["account-access", "Account or access issue"],
    ["technical-problem", "Technical problem"],
    ["service-delivery", "Service delivery question"],
    ["other", "Other"],
  ],
} as const;
const serviceArticles = {
  "GST Filing": ["Prepare GST filing evidence", "Understand filing deadlines"],
  "Compliance Review": ["Prepare compliance review evidence", "Check delivery milestones"],
  "Accounts support": ["Find invoice and payment records", "Request an accounts report"],
} as const;
const initialTicket: SupportTicketInput = {
  service: "GST Filing",
  category: "filing-submission",
  subject: "",
  description: "",
  businessImpact: "medium",
  affectedUsers: 1,
  affectedUrl: "",
  preferredContactMethod: "email",
  notifyByEmail: true,
  notifyInApp: true,
  attachments: [],
};
const ticketTone = {
  open: "info",
  triaged: "warning",
  assigned: "warning",
  "waiting-on-client": "neutral",
  resolved: "success",
} as const;
const impactTone = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
} as const;

function displayStatus(status: SupportTicket["status"]) {
  return status === "open" ? "Open" : status.replaceAll("-", " ");
}

export function SupportTicketWorkspace({
  workspace,
}: {
  workspace: TicketWorkspace;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["support-tickets", workspace],
    queryFn: () => listSupportTickets(workspace),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [ticketInput, setTicketInput] = useState<SupportTicketInput>(initialTicket);
  const [draftReady, setDraftReady] = useState(workspace !== "client");
  const [formError, setFormError] = useState("");
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [submitted, setSubmitted] = useState<SupportTicket | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [attachmentProgress, setAttachmentProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadTimers = useRef<number[]>([]);
  const canManage = workspace === "manager" || workspace === "admin";
  const tickets = query.data ?? [];
  const categories = serviceCategories[ticketInput.service as keyof typeof serviceCategories];
  const duplicate = tickets.find(
    (ticket) =>
      ticket.status !== "resolved" &&
      ticket.service === ticketInput.service &&
      ticket.subject.trim().length > 0 &&
      ticket.subject.trim().toLowerCase() === ticketInput.subject.trim().toLowerCase(),
  );
  const valid =
    ticketInput.subject.trim().length > 0 &&
    ticketInput.description.trim().length > 0 &&
    ticketInput.affectedUsers >= 1 &&
    !duplicate;

  useEffect(() => {
    if (workspace !== "client") return;
    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SupportTicketInput>;
        setTicketInput({ ...initialTicket, ...parsed });
      }
    } catch {
      // Draft storage is optional for the frontend-only mock.
    } finally {
      setDraftReady(true);
    }
  }, [workspace]);

  useEffect(() => {
    if (workspace !== "client" || !draftReady) return;
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(ticketInput));
    } catch {
      // The support form remains usable when local draft storage is unavailable.
    }
  }, [draftReady, ticketInput, workspace]);

  useEffect(
    () => () => uploadTimers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    await query.refetch();
  };

  const resetDraft = () => {
    setTicketInput(initialTicket);
    setAttachmentProgress({});
    setFormError("");
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Clearing a local draft is optional for the mock workflow.
    }
  };

  const createTicket = async () => {
    if (!valid) {
      setFormError("Complete all required fields before submitting your request.");
      return;
    }
    setFormError("");
    setWorking(true);
    try {
      const ticket = await createSupportTicket({
        ...ticketInput,
        affectedUrl: ticketInput.affectedUrl?.trim() || undefined,
      });
      setSubmitted(ticket);
      resetDraft();
      await refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The request could not be submitted.",
      );
    } finally {
      setWorking(false);
    }
  };

  const addAttachments = (files: FileList | File[]) => {
    const available = maxAttachments - ticketInput.attachments.length;
    const accepted = Array.from(files)
      .filter((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        return (
          file.size <= maxAttachmentBytes &&
          Boolean(extension && supportedAttachmentExtensions.has(extension))
        );
      })
      .slice(0, available);
    if (!accepted.length) {
      setFormError(
        "Add up to five supported files, each no larger than 20 MB.",
      );
      return;
    }
    const attachments = accepted.map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    }));
    setTicketInput((current) => ({
      ...current,
      attachments: [...current.attachments, ...attachments],
    }));
    setAttachmentProgress((current) => ({
      ...current,
      ...Object.fromEntries(attachments.map((file) => [file.name, 15])),
    }));
    const timer = window.setTimeout(() => {
      setAttachmentProgress((current) => ({
        ...current,
        ...Object.fromEntries(attachments.map((file) => [file.name, 100])),
      }));
    }, 350);
    uploadTimers.current.push(timer);
  };

  const manage = async (action: () => Promise<SupportTicket>) => {
    setWorking(true);
    try {
      const ticket = await action();
      setSelected(ticket);
      setReply("");
      setResolution("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The ticket update could not be saved.",
      );
    } finally {
      setWorking(false);
    }
  };

  const description =
    workspace === "client"
      ? "Raise and track support requests for your authorised services."
      : workspace === "manager"
        ? "Tickets from your assigned clients. Assign, update, and resolve them."
        : "Tenant-wide client tickets. Triage, assign, and resolve delivery support.";

  if (query.isPending) {
    return <LoadingState label="Loading support tickets" rows={4} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Support tickets could not load"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow={
          workspace === "client"
            ? "Client portal"
            : workspace === "manager"
              ? "Manager"
              : "Tenant Admin"
        }
        title={workspace === "client" ? "Support tickets" : "Client support tickets"}
        description={description}
        actions={
          workspace === "client" ? (
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) setSubmitted(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <CircleHelp data-icon="inline-start" />
                  Create support request
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-w-[720px]"
                title={submitted ? "Request submitted" : "Create a support request"}
                description="Provide the service context and detail required for the delivery team to respond."
              >
                {submitted ? (
                  <SupportConfirmation
                    ticket={submitted}
                    onView={() => {
                      setSelected(submitted);
                      setSubmitted(null);
                      setCreateOpen(false);
                    }}
                    onCreateAnother={() => {
                      resetDraft();
                      setSubmitted(null);
                    }}
                  />
                ) : (
                  <form
                    aria-label="Create support request"
                    className="mx-auto max-h-[80vh] w-full max-w-[640px] overflow-y-auto px-1 scrollbar-none"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createTicket();
                    }}
                  >
                    <h2 className="text-lg font-semibold">Create a support request</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your assigned manager and Company Admin team can view this request.
                    </p>
                    <dl className="mt-4 grid gap-3 rounded-[var(--radius-card)] border bg-muted/40 p-4 text-sm sm:grid-cols-3">
                      <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1 font-medium">Northstar Labs</dd></div>
                      <div><dt className="text-muted-foreground">Company</dt><dd className="mt-1 font-medium">Acme Operations</dd></div>
                      <div><dt className="text-muted-foreground">Requester</dt><dd className="mt-1 font-medium">Taylor Morgan</dd></div>
                    </dl>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <FieldSelect label="Service or project" required value={ticketInput.service} onChange={(service) => {
                        const nextCategories = serviceCategories[service as keyof typeof serviceCategories];
                        setTicketInput((current) => ({ ...current, service, category: nextCategories[0][0] as SupportTicketInput["category"] }));
                      }}>
                        {Object.keys(serviceCategories).map((service) => <option key={service}>{service}</option>)}
                      </FieldSelect>
                      <FieldSelect label="Issue category" required value={ticketInput.category} onChange={(category) => setTicketInput((current) => ({ ...current, category: category as SupportTicketInput["category"] }))}>
                        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </FieldSelect>
                      <FieldSelect label="Business impact" required value={ticketInput.businessImpact} onChange={(businessImpact) => setTicketInput((current) => ({ ...current, businessImpact: businessImpact as SupportTicketInput["businessImpact"] }))}>
                        <option value="low">Low — General question or minor inconvenience</option>
                        <option value="medium">Medium — Work can continue</option>
                        <option value="high">High — Important work is blocked</option>
                        <option value="critical">Critical — Service outage or major disruption</option>
                      </FieldSelect>
                      <label htmlFor="support-affected-users" className="text-sm font-medium">Affected users <span aria-hidden="true">*</span><Input id="support-affected-users" className="mt-1" min="1" type="number" value={ticketInput.affectedUsers} onChange={(event) => setTicketInput((current) => ({ ...current, affectedUsers: Math.max(1, Number(event.target.value) || 1) }))} /></label>
                    </div>
                    {ticketInput.businessImpact === "critical" ? <p className="mt-4 flex gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-[var(--chip-danger-bg)] p-3 text-sm text-danger"><ShieldAlert className="mt-0.5 size-4 shrink-0" />Select Critical only when the service is unavailable, a serious security incident has occurred, or business operations are completely blocked.</p> : null}
                    <label htmlFor="support-subject" className="mt-4 block text-sm font-medium">Brief summary <span aria-hidden="true">*</span><Input id="support-subject" className="mt-1" value={ticketInput.subject} maxLength={120} placeholder="Example: Unable to download the GST filing report" onChange={(event) => setTicketInput((current) => ({ ...current, subject: event.target.value }))} /><span className="mt-1 block text-right text-xs font-normal text-muted-foreground">{ticketInput.subject.length}/120</span></label>
                    {duplicate ? <p className="mt-2 text-sm text-warning" role="alert">A similar active request already exists: {duplicate.id}. Review that request before creating another one.</p> : null}
                    <label htmlFor="support-description" className="mt-4 block text-sm font-medium">Describe the issue <span aria-hidden="true">*</span><textarea aria-label="Describe the issue" id="support-description" className="mt-1 min-h-36 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" value={ticketInput.description} maxLength={2000} placeholder="Please explain what you were trying to do, what happened, what you expected, and any error message you received. Mention when the issue started and whether other users are affected." onChange={(event) => setTicketInput((current) => ({ ...current, description: event.target.value }))} /><span className="mt-1 block text-right text-xs font-normal text-muted-foreground">{ticketInput.description.length}/2000</span></label>
                    <div className="mt-2 rounded-[var(--radius-card)] border bg-muted/40 p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Helpful information to include:</p><ul className="mt-1 list-disc space-y-1 pl-5"><li>Steps you followed</li><li>Error message</li><li>Date and time of the issue</li><li>Number of affected users</li><li>Supporting screenshots</li></ul></div>
                    <label htmlFor="support-affected-url" className="mt-4 block text-sm font-medium">Affected page, feature or URL<Input id="support-affected-url" className="mt-1" type="url" value={ticketInput.affectedUrl ?? ""} placeholder="https://clientportal.example/gst/filing" onChange={(event) => setTicketInput((current) => ({ ...current, affectedUrl: event.target.value }))} /></label>
                    <AttachmentDropzone inputRef={inputRef} attachments={ticketInput.attachments} progress={attachmentProgress} onFiles={addAttachments} onRemove={(name) => setTicketInput((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.name !== name) }))} />
                    <fieldset className="mt-5"><legend className="text-sm font-medium">Preferred contact method</legend><div className="mt-2 flex flex-wrap gap-4 text-sm"><RadioField name="contact" value="email" checked={ticketInput.preferredContactMethod === "email"} onChange={() => setTicketInput((current) => ({ ...current, preferredContactMethod: "email" }))} label="Email" /><RadioField name="contact" value="phone" checked={ticketInput.preferredContactMethod === "phone"} onChange={() => setTicketInput((current) => ({ ...current, preferredContactMethod: "phone" }))} label="Phone call" /><RadioField name="contact" value="no-callback" checked={ticketInput.preferredContactMethod === "no-callback"} onChange={() => setTicketInput((current) => ({ ...current, preferredContactMethod: "no-callback" }))} label="No callback required" /></div></fieldset>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm"><CheckboxField checked={ticketInput.notifyByEmail} onChange={(notifyByEmail) => setTicketInput((current) => ({ ...current, notifyByEmail }))} label="Email me about updates" /><CheckboxField checked={ticketInput.notifyInApp} onChange={(notifyInApp) => setTicketInput((current) => ({ ...current, notifyInApp }))} label="Show in-app updates" /></div>
                    <section className="mt-5 rounded-[var(--radius-card)] border p-4 text-sm"><p className="font-medium">Suggested help articles</p><ul className="mt-2 space-y-2">{serviceArticles[ticketInput.service as keyof typeof serviceArticles].map((article) => <li key={article}><Link className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/client/documents">{article}</Link></li>)}</ul></section>
                    {formError ? <p className="mt-4 text-sm text-danger" role="alert">{formError}</p> : null}
                    <p className="mt-5 text-xs text-muted-foreground">By submitting this request, you confirm that the information provided is accurate and does not contain passwords or confidential authentication credentials.</p>
                    <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={working}>Cancel</Button><Button type="submit" disabled={!valid || working}>{working ? "Submitting…" : "Submit request"}</Button></div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Ticket queue</CardTitle>
          <CardDescription>{workspace === "client" ? "Updates from your support team are recorded on each request." : "Client-visible replies and assignment changes are recorded on each request."}</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length ? <ul className="flex flex-col divide-y">{tickets.map((ticket) => <li key={ticket.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{ticket.subject}</p><Badge tone={ticketTone[ticket.status]}>{displayStatus(ticket.status)}</Badge><Badge tone={impactTone[ticket.businessImpact]}>{ticket.businessImpact} impact</Badge></div><p className="mt-1 text-sm text-muted-foreground">{ticket.id} · {ticket.client} · {ticket.service} · Updated {ticket.updatedOn}</p><p className="mt-1 text-sm text-muted-foreground">Owner: {ticket.assignee ?? "Awaiting assignment"}</p></div><Button size="sm" variant="outline" onClick={() => { setSelected(ticket); setAssigneeId(ticket.assigneeId ?? ""); }}>View request</Button></li>)}</ul> : <EmptyState title="No support requests" description={workspace === "client" ? "Create a request when you need help with an authorised service." : "New client requests will appear here."} />}
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent title={selected?.subject ?? "Support request"} description="Request details, activity, and authorised support actions.">
          {selected ? <div className="max-h-[75vh] overflow-y-auto pr-4"><h2 className="font-semibold">{selected.subject}</h2><p className="mt-2 text-sm text-muted-foreground">{selected.id} · {selected.service} · {selected.category.replaceAll("-", " ")}</p><p className="mt-4 whitespace-pre-wrap text-sm">{selected.description}</p><div className="mt-5 rounded-[var(--radius-card)] border bg-muted/40 p-4 text-sm"><p><strong>Status:</strong> {displayStatus(selected.status)}</p><p className="mt-1"><strong>Business impact:</strong> {selected.businessImpact}</p><p className="mt-1"><strong>Expected first response:</strong> {selected.expectedFirstResponse}</p><p className="mt-1"><strong>Assigned to:</strong> {selected.assignee ?? "Not assigned"}</p>{selected.resolution ? <p className="mt-1"><strong>Resolution:</strong> {selected.resolution}</p> : null}</div>{canManage && selected.status !== "resolved" ? <ManagerActions workspace={workspace} selected={selected} assigneeId={assigneeId} working={working} reply={reply} resolution={resolution} setAssigneeId={setAssigneeId} setReply={setReply} setResolution={setResolution} onManage={manage} /> : null}<div className="mt-5 border-t pt-5"><p className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="size-4" />Activity</p><ol className="mt-3 flex flex-col gap-3">{selected.activity.map((activity) => <li key={activity.id} className="text-sm"><p>{activity.message}</p><p className="mt-1 text-xs text-muted-foreground">{activity.actor} · {activity.createdOn}</p></li>)}</ol></div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupportConfirmation({ ticket, onView, onCreateAnother }: { ticket: SupportTicket; onView: () => void; onCreateAnother: () => void }) {
  return <div className="pr-8"><h2 className="text-lg font-semibold">Your support request has been submitted.</h2><dl className="mt-5 grid gap-3 rounded-[var(--radius-card)] border bg-muted/40 p-4 text-sm"><div><dt className="text-muted-foreground">Ticket ID</dt><dd className="mt-1 font-medium">{ticket.id}</dd></div><div><dt className="text-muted-foreground">Current status</dt><dd className="mt-1 font-medium">Open</dd></div><div><dt className="text-muted-foreground">Expected first response</dt><dd className="mt-1 font-medium">{ticket.expectedFirstResponse}</dd></div></dl><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onCreateAnother}>Create another request</Button><Button onClick={onView}>View request</Button></div></div>;
}

function AttachmentDropzone({ inputRef, attachments, progress, onFiles, onRemove }: { inputRef: React.RefObject<HTMLInputElement | null>; attachments: SupportTicketInput["attachments"]; progress: Record<string, number>; onFiles: (files: FileList | File[]) => void; onRemove: (name: string) => void }) {
  return <section className="mt-5"><p className="text-sm font-medium">Attachments</p><div className="mt-2 rounded-[var(--radius-card)] border border-dashed p-4 text-sm" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFiles(event.dataTransfer.files); }}><input ref={inputRef} className="sr-only" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.csv,.mp4,.txt,.log" onChange={(event) => event.target.files && onFiles(event.target.files)} /><Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><FileUp data-icon="inline-start" />Upload files</Button><span className="ml-3 text-muted-foreground">Drag and drop screenshots, PDFs, or videos</span><p className="mt-3 text-xs text-muted-foreground">Maximum 5 files · 20 MB per file · PNG, JPG, WebP, PDF, DOCX, XLSX, CSV, MP4, TXT, and LOG files only.</p><p className="mt-2 text-xs text-danger">Do not upload passwords, OTPs, card details, or other highly sensitive information.</p></div>{attachments.length ? <ul className="mt-3 space-y-2">{attachments.map((attachment) => <li key={attachment.name} className="rounded-[var(--radius-control)] border p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="truncate">{attachment.name}</span><button type="button" className="text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onRemove(attachment.name)}>Remove</button></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress[attachment.name] ?? 100}%` }} /></div></li>)}</ul> : null}</section>;
}

function ManagerActions({ workspace, selected, assigneeId, working, reply, resolution, setAssigneeId, setReply, setResolution, onManage }: { workspace: "manager" | "admin"; selected: SupportTicket; assigneeId: string; working: boolean; reply: string; resolution: string; setAssigneeId: (value: string) => void; setReply: (value: string) => void; setResolution: (value: string) => void; onManage: (action: () => Promise<SupportTicket>) => void }) {
  return <div className="mt-5 grid gap-4 border-t pt-5"><div><label htmlFor="support-ticket-assignee" className="flex items-center gap-2 text-sm font-medium"><UserRoundCheck className="size-4" />Assign employee</label><div className="mt-2 flex gap-2"><Select id="support-ticket-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Choose employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select><Button disabled={!assigneeId || working} onClick={() => { const employee = employees.find((item) => item.id === assigneeId); if (employee) onManage(() => assignSupportTicket(workspace, selected.id, employee)); }}>Assign</Button></div></div><label className="text-sm font-medium">Client-visible reply<textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reply} onChange={(event) => setReply(event.target.value)} /></label><Button variant="outline" disabled={reply.trim().length < 5 || working} onClick={() => onManage(() => replyToSupportTicket(workspace, selected.id, reply))}><Send data-icon="inline-start" />Send update</Button><label className="text-sm font-medium">Resolution<textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><Button disabled={resolution.trim().length < 10 || working} onClick={() => onManage(() => resolveSupportTicket(workspace, selected.id, resolution))}>Resolve request</Button></div>;
}

function FieldSelect({ label, required, value, onChange, children }: { label: string; required?: boolean; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const id = `support-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <label htmlFor={id} className="text-sm font-medium">{label} {required ? <span aria-hidden="true">*</span> : null}<Select aria-label={label} id={id} className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>;
}

function RadioField({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  return <label className="inline-flex items-center gap-2"><input type="radio" name={name} value={value} checked={checked} onChange={onChange} />{label}</label>;
}

function CheckboxField({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
