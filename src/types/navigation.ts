import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/types/domain";

export type NavigationItem = {
  label: string;
  href?: string;
  icon?: LucideIcon;
  permissions?: Permission[];
  badge?: string | number;
  children?: NavigationItem[];
};
