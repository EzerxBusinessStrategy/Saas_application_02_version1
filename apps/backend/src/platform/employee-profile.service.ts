import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireEmployeeContext } from "./employee-context";
import { EmployeeProfileDto } from "./employee-profile.dto";
import { EmployeeProfileRepository, EmployeeProfileRow } from "./employee-profile.repository";

@Injectable()
export class EmployeeProfileService {
  constructor(@Inject(EmployeeProfileRepository) private readonly repository: EmployeeProfileRepository) {}

  async get(context: RequestContext): Promise<EmployeeProfileDto> {
    return mapProfile(await this.repository.get(requireEmployeeContext(context)));
  }
}

function mapProfile(row: EmployeeProfileRow): EmployeeProfileDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    employeeCode: row.employee_code,
    tenantName: row.tenant_name,
    role: row.role,
    status: row.status,
    department: row.department,
    experienceLevel: row.experience_level,
    weeklyCapacityHours: row.weekly_capacity_hours === null ? null : Number(row.weekly_capacity_hours),
    workGroups: row.work_groups ?? [],
  };
}
