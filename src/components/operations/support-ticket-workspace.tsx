"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, MessageSquare, Send, UserRoundCheck } from "lucide-react";
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

const employees = [
  { id: "emp-riley", name: "Riley Shah" },
  { id: "emp-aarav", name: "Aarav Mehta" },
  { id: "emp-zoe", name: "Zoe Martin" },
];
const initialTicket: SupportTicketInput = {
  service: "GST Filing",
  category: "delivery",
  subject: "",
  description: "",
  priority: "normal",
};
const ticketTone = {
  new: "info",
  triaged: "warning",
  assigned: "warning",
  "waiting-on-client": "neutral",
  resolved: "success",
} as const;

export function SupportTicketWorkspace({ workspace }: { workspace: TicketWorkspace }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["support-tickets", workspace],
    queryFn: () => listSupportTickets(workspace),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [ticketInput, setTicketInput] = useState<SupportTicketInput>(initialTicket);
  const [formError, setFormError] = useState("");
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const canManage = workspace === "manager" || workspace === "admin";

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    await query.refetch();
  };
  const createTicket = async () => {
    setFormError("");
    setWorking(true);
    try {
      await createSupportTicket(ticketInput);
      setTicketInput(initialTicket);
      setCreateOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Ticket could not be created.");
    } finally {
      setWorking(false);
    }
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
        error instanceof Error ? error.message : "The ticket update could not be saved.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (query.isPending) return <LoadingState label="Loading support tickets" rows={4} />;
  if (query.isError)
    return <ErrorState title="Support tickets could not load" onRetry={() => void query.refetch()} />;
  const tickets = query.data;
  const title = workspace === "client" ? "Support tickets" : "Client support tickets";
  const description =
    workspace === "client"
      ? "Raise and track support requests for your authorised services."
      : workspace === "manager"
        ? "Tickets from your assigned clients. Assign, update, and resolve them."
        : "Tenant-wide client tickets. Triage, assign, and resolve delivery support.";

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow={workspace === "client" ? "Client portal" : workspace === "manager" ? "Manager" : "Tenant Admin"}
        title={title}
        description={description}
        actions={
          workspace === "client" ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CircleHelp data-icon="inline-start" />
                  Raise support ticket
                </Button>
              </DialogTrigger>
              <DialogContent title="Raise support ticket" description="Provide the service context and detail required for the delivery team to respond.">
                <form
                  className="pr-8"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createTicket();
                  }}
                >
                  <h2 className="font-semibold">Raise support ticket</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Your assigned manager and tenant administration team can view this ticket.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FieldSelect label="Related service" value={ticketInput.service} onChange={(service) => setTicketInput((current) => ({ ...current, service }))}>
                      <option>GST Filing</option><option>Compliance Review</option><option>Accounts support</option>
                    </FieldSelect>
                    <FieldSelect label="Category" value={ticketInput.category} onChange={(category) => setTicketInput((current) => ({ ...current, category: category as SupportTicketInput["category"] }))}>
                      <option value="delivery">Delivery question</option><option value="documents">Documents</option><option value="billing">Billing</option><option value="access">Access</option><option value="other">Other</option>
                    </FieldSelect>
                    <FieldSelect label="Priority" value={ticketInput.priority} onChange={(priority) => setTicketInput((current) => ({ ...current, priority: priority as SupportTicketInput["priority"] }))}>
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                    </FieldSelect>
                  </div>
                  <label className="mt-4 block text-sm font-medium">Subject<Input className="mt-1" value={ticketInput.subject} maxLength={120} onChange={(event) => setTicketInput((current) => ({ ...current, subject: event.target.value }))} /></label>
                  <label className="mt-4 block text-sm font-medium">Describe the issue<textarea className="mt-1 min-h-28 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={ticketInput.description} maxLength={2000} onChange={(event) => setTicketInput((current) => ({ ...current, description: event.target.value }))} /></label>
                  {formError ? <p className="mt-3 text-sm text-danger" role="alert">{formError}</p> : null}
                  <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={working}>Cancel</Button><Button type="submit" disabled={working}>Submit ticket</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <Card>
        <CardHeader><CardTitle>Ticket queue</CardTitle><CardDescription>{workspace === "client" ? "Updates from your support team are recorded on each ticket." : "Client-visible replies and assignment changes are recorded on each ticket."}</CardDescription></CardHeader>
        <CardContent>
          {tickets.length ? <ul className="flex flex-col divide-y">{tickets.map((ticket) => <li key={ticket.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{ticket.subject}</p><Badge tone={ticketTone[ticket.status]}>{ticket.status.replaceAll("-", " ")}</Badge><Badge tone={ticket.priority === "urgent" || ticket.priority === "high" ? "danger" : "neutral"}>{ticket.priority}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{ticket.id} · {ticket.client} · {ticket.service} · Updated {ticket.updatedOn}</p><p className="mt-1 text-sm text-muted-foreground">Owner: {ticket.assignee ?? "Awaiting assignment"}</p></div><Button size="sm" variant="outline" onClick={() => { setSelected(ticket); setAssigneeId(ticket.assigneeId ?? ""); }}>View ticket</Button></li>)}</ul> : <EmptyState title="No support tickets" description={workspace === "client" ? "Raise a ticket when you need help with an authorised service." : "New client tickets will appear here."} />}
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent title={selected?.subject ?? "Support ticket"} description="Ticket details, activity, and authorised support actions.">
          {selected ? <div className="max-h-[75vh] overflow-y-auto pr-8"><h2 className="font-semibold">{selected.subject}</h2><p className="mt-2 text-sm text-muted-foreground">{selected.id} · {selected.category.replaceAll("-", " ")} · {selected.service}</p><p className="mt-4 whitespace-pre-wrap text-sm">{selected.description}</p><div className="mt-5 rounded-[var(--radius-card)] border bg-muted/40 p-4 text-sm"><p><strong>Status:</strong> {selected.status.replaceAll("-", " ")}</p><p className="mt-1"><strong>Assigned to:</strong> {selected.assignee ?? "Not assigned"}</p>{selected.resolution ? <p className="mt-1"><strong>Resolution:</strong> {selected.resolution}</p> : null}</div>
            {canManage && selected.status !== "resolved" ? <div className="mt-5 grid gap-4 border-t pt-5"><div><p className="flex items-center gap-2 text-sm font-medium"><UserRoundCheck className="size-4" />Assign employee</p><div className="mt-2 flex gap-2"><Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Choose employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select><Button disabled={!assigneeId || working} onClick={() => { const employee = employees.find((item) => item.id === assigneeId); if (employee) void manage(() => assignSupportTicket(workspace, selected.id, employee)); }}>Assign</Button></div></div><label className="text-sm font-medium">Client-visible reply<textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reply} onChange={(event) => setReply(event.target.value)} /></label><Button variant="outline" disabled={reply.trim().length < 5 || working} onClick={() => void manage(() => replyToSupportTicket(workspace, selected.id, reply))}><Send data-icon="inline-start" />Send update</Button><label className="text-sm font-medium">Resolution<textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><Button disabled={resolution.trim().length < 10 || working} onClick={() => void manage(() => resolveSupportTicket(workspace, selected.id, resolution))}>Resolve ticket</Button></div> : null}
            <div className="mt-5 border-t pt-5"><p className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="size-4" />Activity</p><ol className="mt-3 flex flex-col gap-3">{selected.activity.map((activity) => <li key={activity.id} className="text-sm"><p>{activity.message}</p><p className="mt-1 text-xs text-muted-foreground">{activity.actor} · {activity.createdOn}</p></li>)}</ol></div></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="text-sm font-medium">{label}<Select className="mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>;
}
