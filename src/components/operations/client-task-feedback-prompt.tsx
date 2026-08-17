"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPendingTaskFeedback } from "@/features/client-portal/api/task-feedback-api";
import { ClientTaskFeedbackDialog } from "@/components/operations/client-task-feedback-dialog";

export function ClientTaskFeedbackPrompt() {
  const queryClient = useQueryClient();
  const [dismissedTaskIds, setDismissedTaskIds] = useState<readonly string[]>([]);
  const pendingQuery = useQuery({
    queryKey: ["client-task-feedback-pending"],
    queryFn: listPendingTaskFeedback,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });

  const activeItem = useMemo(() => {
    const items = pendingQuery.data?.items ?? [];
    return items.find((item) => !dismissedTaskIds.includes(item.taskId)) ?? null;
  }, [dismissedTaskIds, pendingQuery.data?.items]);

  function handleSubmitted() {
    void queryClient.invalidateQueries({ queryKey: ["client-task-feedback-pending"] });
  }

  function handleDismiss() {
    if (!activeItem) return;
    setDismissedTaskIds((current) =>
      current.includes(activeItem.taskId) ? current : [...current, activeItem.taskId],
    );
  }

  if (!activeItem) return null;

  return (
    <ClientTaskFeedbackDialog
      item={activeItem}
      open
      onSubmitted={handleSubmitted}
      onDismiss={handleDismiss}
    />
  );
}
