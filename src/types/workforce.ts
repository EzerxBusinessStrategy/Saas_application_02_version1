export const experienceLevels = ["junior", "mid", "senior", "lead"] as const;
export const availabilityStates = [
  "available",
  "partially-available",
  "unavailable",
] as const;
export const employmentStatuses = ["active", "on-leave", "inactive"] as const;
export const workloadRisks = ["balanced", "at-risk", "overloaded"] as const;

export type ExperienceLevel = (typeof experienceLevels)[number];
export type Availability = (typeof availabilityStates)[number];
export type EmploymentStatus = (typeof employmentStatuses)[number];
export type WorkloadRisk = (typeof workloadRisks)[number];

export type Employee = {
  id: string;
  code: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  department: string;
  categories: string[];
  skills: string[];
  experienceLevel: ExperienceLevel | null;
  manager: { id: string; name: string } | null;
  isManager?: boolean;
  workload: {
    allocatedHours: number;
    capacityHours: number;
    risk: WorkloadRisk;
  };
  utilisationPercent: number;
  activeTasks: number;
  availability: Availability;
  employmentStatus: EmploymentStatus;
  workGroups: { id: string; name: string }[];
};

export type EmployeeDirectoryFilters = {
  query?: string;
  department?: string;
  category?: string;
  managerId?: string;
  experienceLevel?: ExperienceLevel;
  availability?: Availability;
  employmentStatus?: EmploymentStatus;
  workloadRisk?: WorkloadRisk;
};
