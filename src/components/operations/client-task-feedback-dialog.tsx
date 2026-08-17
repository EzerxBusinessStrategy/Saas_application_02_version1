"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  submitTaskFeedback,
  type PendingTaskFeedbackItem,
} from "@/features/client-portal/api/task-feedback-api";
import { StarRating } from "@/components/shared/star-rating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type ClientTaskFeedbackDialogProps = {
  item: PendingTaskFeedbackItem;
  open: boolean;
  onSubmitted: () => void;
  onDismiss?: () => void;
};

export function ClientTaskFeedbackDialog({
  item,
  open,
  onSubmitted,
  onDismiss,
}: ClientTaskFeedbackDialogProps) {
  const [taskRating, setTaskRating] = useState(0);
  const [employeeRating, setEmployeeRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTaskRating(0);
      setEmployeeRating(0);
    }
  }, [open, item.taskId]);

  const canSubmit = taskRating > 0 && employeeRating > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitTaskFeedback({
        taskId: item.taskId,
        invoiceId: item.invoiceId,
        taskRating,
        employeeRating,
        idempotencyKey: `task-feedback:${item.taskId}`,
      });
      toast.success("Thank you for your feedback.");
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Feedback could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss?.()}>
      <DialogContent
        title="Task feedback"
        description="Your invoice is ready. Rate the work now, or choose Later and finish it from Feedback within 60 days of completion."
        className="max-w-lg"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Card className="border-dashed shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{item.taskTitle}</CardTitle>
              <CardDescription>
                Invoice {item.invoiceNumber} · Assigned to {item.employeeName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <StarRating
                label="Task review"
                value={taskRating}
                onChange={setTaskRating}
                disabled={submitting}
              />
              <StarRating
                label={`Employee review · ${item.employeeName}`}
                value={employeeRating}
                onChange={setEmployeeRating}
                disabled={submitting}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => {
                    toast.message("Saved for later", {
                      description: "Open Feedback in the sidebar to rate this task within 60 days of completion.",
                    });
                    onDismiss?.();
                  }}
                >
                  Later
                </Button>
                <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
                  {submitting ? "Submitting..." : "Submit feedback"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
