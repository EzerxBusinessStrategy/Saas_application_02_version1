import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";

export type EmployeeRequestContext = RequestContext & {
  readonly tenantId: string;
  readonly membershipId: string;
};

export type EmployeeManagerRequestContext = EmployeeRequestContext & {
  readonly roles: readonly ("EMPLOYEE" | "MANAGER" | string)[];
};

export function requireEmployeeContext(context: RequestContext): EmployeeRequestContext {
  if (
    !context.tenantId ||
    !context.membershipId ||
    context.isPlatformAdmin ||
    !context.roles.includes("EMPLOYEE")
  ) {
    throw forbiddenPortal();
  }
  return context as EmployeeRequestContext;
}

export function requireEmployeeManagerContext(context: RequestContext): EmployeeManagerRequestContext {
  if (
    !context.tenantId ||
    !context.membershipId ||
    context.isPlatformAdmin ||
    !context.roles.includes("EMPLOYEE") ||
    !context.roles.includes("MANAGER")
  ) {
    throw forbiddenPortal();
  }
  return context as EmployeeManagerRequestContext;
}
