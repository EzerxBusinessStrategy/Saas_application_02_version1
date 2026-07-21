"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, ReceiptText } from "lucide-react";
import { getOperationalWorkspace } from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Workspace } from "@/types/domain";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function FinanceDocuments({
  section,
  workspace = "admin",
}: {
  section: "invoices" | "payments" | "agreements" | "documents";
  workspace?: Extract<Workspace, "admin" | "client">;
}) {
  const query = useQuery({
    queryKey: ["finance-documents", workspace],
    queryFn: () => getOperationalWorkspace(workspace),
  });
  if (query.isPending)
    return <LoadingState label={`Loading ${section}`} rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title={`${section} could not load`}
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (section === "documents" || section === "agreements")
    return (
      <DocumentList
        title={section === "agreements" ? "Agreements" : "Documents"}
        documents={data.documents.filter(
          (document) =>
            section === "documents" || document.category === "agreement",
        )}
      />
    );
  if (section === "payments")
    return (
      <FinanceList
        title="Payments"
        description="Recorded payment status for authorised client invoices."
        items={data.payments.map((payment) => ({
          id: payment.id,
          title: payment.client,
          detail: `${rupees.format(payment.amount)} · ${payment.method.replaceAll("-", " ")} · ${payment.receivedOn}`,
          status: payment.status,
        }))}
      />
    );
  return (
    <FinanceList
      title="Invoices"
      description="Client billing status and outstanding balances. Zero, missing, and not-applicable values are shown explicitly when available."
      items={data.invoices.map((invoice) => ({
        id: invoice.id,
        title: `${invoice.client} · ${invoice.engagement}`,
        detail: `${rupees.format(invoice.amount - invoice.paidAmount)} outstanding of ${rupees.format(invoice.amount)} · due ${invoice.dueOn}`,
        status: invoice.status,
      }))}
    />
  );
}

function FinanceList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; detail: string; status: string }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader eyebrow="Finance" title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-[18px] text-primary" />
            {title}
          </CardTitle>
          <CardDescription>
            Read-only mock records until the authorised finance API is
            available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <ul className="flex flex-col divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-4 first:pt-0"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      item.status === "paid" || item.status === "received"
                        ? "complete"
                        : item.status === "overdue" ||
                            item.status === "reversed"
                          ? "at-risk"
                          : "pending"
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={`No ${title.toLowerCase()}`}
              description="Authorised records will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function DocumentList({
  title,
  documents,
}: {
  title: string;
  documents: Array<{
    id: string;
    name: string;
    client: string;
    category: string;
    updatedOn: string;
  }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Operations"
        title={title}
        description="Authorised delivery, agreement, and finance documents."
      />
      <Card>
        <CardContent className="pt-[30px]">
          {documents.length ? (
            <ul className="flex flex-col divide-y">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center gap-3 py-4 first:pt-0"
                >
                  <FileText className="size-4 text-primary" />
                  <div>
                    <p className="font-medium">{document.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {document.client} · {document.category} · updated{" "}
                      {document.updatedOn}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={`No ${title.toLowerCase()}`}
              description="No authorised documents are available."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
