"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export function DialogContent({
  children,
  className,
  title = "Dialog",
  description,
  blockOutsideClose = false,
  onBlockedOutsideClose,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  blockOutsideClose?: boolean;
  onBlockedOutsideClose?: () => void;
}) {
  const [shake, setShake] = useState(false);

  const triggerBlockedCloseFeedback = () => {
    onBlockedOutsideClose?.();
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/35" />
      <DialogPrimitive.Content
        onPointerDownOutside={(event) => {
          if (isDatePickerPopoverEvent(event)) {
            event.preventDefault();
            return;
          }
          if (!blockOutsideClose) return;
          event.preventDefault();
          triggerBlockedCloseFeedback();
        }}
        onInteractOutside={(event) => {
          if (isDatePickerPopoverEvent(event)) {
            event.preventDefault();
            return;
          }
          if (!blockOutsideClose) return;
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (isDatePickerPopoverEvent(event)) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (!blockOutsideClose) return;
          event.preventDefault();
          triggerBlockedCloseFeedback();
        }}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-xl outline-none",
          shake && "dialog-shake",
          className,
        )}
      >
        <DialogPrimitive.Title className="sr-only">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function isDatePickerPopoverEvent(event: { target: EventTarget | null }): boolean {
  const target = event.target;
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest("[data-date-picker-popover]"));
}
