import { AuthState } from "@/components/auth/auth-state";

export default function SessionExpiredPage() {
  return (
    <AuthState
      title="Your session has expired"
      description="Sign in again to continue securely."
    />
  );
}
