import { Badge } from "@/components/ui/badge";

const tones = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
} as const;

export function PriorityBadge({ priority }: { priority: keyof typeof tones }) {
  return <Badge tone={tones[priority]}>{priority}</Badge>;
}
