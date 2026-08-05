import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

export function authenticationRequired(): UnauthorizedException {
  return new UnauthorizedException({
    code: "AUTHENTICATION_REQUIRED",
    message: "Bearer authentication is required.",
  });
}

export function invalidAccessToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: "INVALID_ACCESS_TOKEN",
    message: "Access token is invalid.",
  });
}

export function sessionExpired(): UnauthorizedException {
  return new UnauthorizedException({
    code: "SESSION_EXPIRED",
    message: "Session is no longer active.",
  });
}

export function authConfigurationMissing(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: "AUTH_CONFIGURATION_MISSING",
    message: "Authentication is not configured.",
  });
}

export function databaseNotConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: "DATABASE_NOT_CONFIGURED",
    message: "Database is not configured.",
  });
}

export function applicationUserNotFound(): ForbiddenException {
  return new ForbiddenException({
    code: "APPLICATION_USER_NOT_FOUND",
    message: "Application user is not active for this workspace.",
  });
}

export function userSuspended(): ForbiddenException {
  return new ForbiddenException({
    code: "USER_SUSPENDED",
    message: "Application user is not active for this workspace.",
  });
}

export function tenantSelectionRequired(): ConflictException {
  return new ConflictException({
    code: "TENANT_SELECTION_REQUIRED",
    message: "Select an active tenant workspace.",
  });
}

export function invalidTenantSelection(): ForbiddenException {
  return new ForbiddenException({
    code: "INVALID_TENANT_SELECTION",
    message: "Selected tenant is not available.",
  });
}

export function ambiguousTenantMembership(): ForbiddenException {
  return new ForbiddenException({
    code: "AMBIGUOUS_TENANT_MEMBERSHIP",
    message: "User has more than one active tenant membership. Tenant access is not configured correctly.",
  });
}

export function invalidTenantSelectionInput(message: string): BadRequestException {
  return new BadRequestException({
    code: "INVALID_TENANT_SELECTION_INPUT",
    message,
  });
}

export function tenantSuspended(): ForbiddenException {
  return new ForbiddenException({
    code: "TENANT_SUSPENDED",
    message: "Selected tenant is not active.",
  });
}

export function missingMembership(): ForbiddenException {
  return new ForbiddenException({
    code: "MEMBERSHIP_NOT_FOUND",
    message: "Active tenant membership is required.",
  });
}

export function inactiveMembership(): ForbiddenException {
  return new ForbiddenException({
    code: "MEMBERSHIP_INACTIVE",
    message: "Active tenant membership is required.",
  });
}

export function forbiddenPortal(): ForbiddenException {
  return new ForbiddenException({
    code: "FORBIDDEN_PORTAL",
    message: "Selected portal is not available for this membership.",
  });
}

export function roleNotAssigned(): ForbiddenException {
  return new ForbiddenException({
    code: "ROLE_NOT_ASSIGNED",
    message: "Selected role is not assigned to this membership.",
  });
}

export function permissionDenied(): ForbiddenException {
  return new ForbiddenException({
    code: "PERMISSION_DENIED",
    message: "Permission is required.",
  });
}

export function invitationRoleNotAllowed(): ForbiddenException {
  return new ForbiddenException({
    code: "INVITATION_ROLE_NOT_ALLOWED",
    message: "Requested role cannot be assigned by this membership.",
  });
}

export function verifiedInviteEmailRequired(): ForbiddenException {
  return new ForbiddenException({
    code: "VERIFIED_INVITE_EMAIL_REQUIRED",
    message: "Authenticated verified email is required to accept this invitation.",
  });
}
