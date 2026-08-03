import { Badge } from "@/components/ui/badge";
import type { Status } from "@/types/domain";
import type {
  Client,
  ServiceEngagement,
  Tenant,
  WorkGroup,
} from "@/types/administration";
import type {
  Availability,
  EmploymentStatus,
  WorkloadRisk,
} from "@/types/workforce";
import { cn } from "@/lib/utils";

type BadgeStatus =
  | Status
  | Availability
  | EmploymentStatus
  | WorkloadRisk
  | Tenant["status"]
  | Client["status"]
  | Client["deliveryHealth"]
  | ServiceEngagement["status"]
  | ServiceEngagement["slaStatus"]
  | WorkGroup["status"]
  | WorkGroup["slaStatus"];

const tone: Record<
  BadgeStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  "on-track": "success",
  "at-risk": "warning",
  blocked: "danger",
  complete: "info",
  pending: "neutral",
  available: "success",
  "partially-available": "warning",
  unavailable: "danger",
  active: "success",
  pending_activation: "info",
  "on-leave": "warning",
  inactive: "neutral",
  balanced: "info",
  overloaded: "danger",
  suspended: "danger",
  onboarding: "info",
  paused: "warning",
  archived: "neutral",
  cancelled: "neutral",
  pending_deletion: "warning",
  healthy: "success",
  watch: "warning",
  planning: "info",
  "on-hold": "warning",
};

export function StatusBadge({
  status,
  className,
}: {
  status: BadgeStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(className)} tone={tone[status]}>
      {status.replaceAll("-", " ").replaceAll("_", " ")}
    </Badge>
  );
}
