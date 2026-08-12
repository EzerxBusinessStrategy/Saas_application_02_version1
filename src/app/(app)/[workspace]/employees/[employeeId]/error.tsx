"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function EmployeeProfileError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Employee profile could not load"
      description="The profile could not be opened. Try again in a moment."
      onRetry={reset}
    />
  );
}
