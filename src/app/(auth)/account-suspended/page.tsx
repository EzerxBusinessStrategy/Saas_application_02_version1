import { AuthState } from "@/components/auth/auth-state";

export default function AccountSuspendedPage() {
  return (
    <AuthState
      title="Your account is suspended"
      description="Contact your tenant administrator to review your account status."
    />
  );
}
