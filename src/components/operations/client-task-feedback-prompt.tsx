"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPendingTaskFeedback } from "@/features/client-portal/api/task-feedback-api";
import { ClientTaskFeedbackDialog } from "@/components/operations/client-task-feedback-dialog";
import {
  canShowClientFeedbackPrompt,
  markClientFeedbackPromptShown,
  markClientFeedbackPromptSnoozed,
  readClientFeedbackPromptState,
  writeClientFeedbackPromptState,
} from "@/lib/client-feedback-prompt";

export function ClientTaskFeedbackPrompt() {
  const queryClient = useQueryClient();
  const [openThisVisit, setOpenThisVisit] = useState(false);
  const pendingQuery = useQuery({
    queryKey: ["client-task-feedback-pending"],
    queryFn: listPendingTaskFeedback,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const pendingItem = pendingQuery.data?.items[0] ?? null;

  useEffect(() => {
    if (openThisVisit || !pendingItem) return;
    const state = readClientFeedbackPromptState();
    if (!canShowClientFeedbackPrompt(state)) return;
    writeClientFeedbackPromptState(markClientFeedbackPromptShown(state));
    setOpenThisVisit(true);
  }, [openThisVisit, pendingItem]);

  function handleSubmitted() {
    writeClientFeedbackPromptState(markClientFeedbackPromptShown(readClientFeedbackPromptState()));
    setOpenThisVisit(false);
    void queryClient.invalidateQueries({ queryKey: ["client-task-feedback-pending"] });
  }

  function handleDismiss() {
    writeClientFeedbackPromptState(markClientFeedbackPromptSnoozed(readClientFeedbackPromptState()));
    setOpenThisVisit(false);
  }

  if (!openThisVisit || !pendingItem) return null;

  return (
    <ClientTaskFeedbackDialog
      item={pendingItem}
      open
      onSubmitted={handleSubmitted}
      onDismiss={handleDismiss}
    />
  );
}
