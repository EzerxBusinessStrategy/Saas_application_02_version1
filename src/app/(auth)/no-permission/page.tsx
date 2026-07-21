import { AuthState } from "@/components/auth/auth-state";

export default function NoPermissionPage() {
  return (
    <AuthState
      title="You do not have access"
      description="Ask your tenant administrator if you need access to this area."
      icon="permission"
    />
  );
}
