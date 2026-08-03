import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

export function RequirePermissions(...permissions: readonly string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
