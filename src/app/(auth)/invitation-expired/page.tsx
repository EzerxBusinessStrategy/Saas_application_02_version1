import { AuthState } from "@/components/auth/auth-state";

export default function InvitationExpiredPage() {
  return (
    <AuthState
      title="This invitation has expired"
      description="Ask a tenant administrator to send you a new invitation."
    />
  );
}
