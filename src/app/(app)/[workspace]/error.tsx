"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="This workspace could not load" onRetry={reset} />;
}
