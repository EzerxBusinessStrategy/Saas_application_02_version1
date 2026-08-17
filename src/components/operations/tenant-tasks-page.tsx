"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TenantServiceRequestsInbox } from "@/components/tenant-administration/service-requests";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { tenantTaskReviewHref } from "@/features/operations/tenant-admin-task-map";

export function TenantTasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTaskId = searchParams.get("task");

  useEffect(() => {
    if (!requestedTaskId) return;
    router.replace(tenantTaskReviewHref(requestedTaskId));
  }, [requestedTaskId, router]);

  if (requestedTaskId) {
    return <LoadingState label="Opening task review" rows={4} />;
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Delivery"
        title="Task request"
        description="Review client service requests and allot the responsible employee."
      />
      <TenantServiceRequestsInbox />
    </div>
  );
}
