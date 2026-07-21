import { AuthState } from "@/components/auth/auth-state";

export default function TenantSuspendedPage() {
  return (
    <AuthState
      title="This tenant is suspended"
      description="Contact your tenant owner or platform support for help restoring access."
    />
  );
}
