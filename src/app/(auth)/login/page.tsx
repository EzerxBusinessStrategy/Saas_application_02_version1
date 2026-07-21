import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
export default function Login() {
  return (
    <>
      <AuthForm mode="login" />
      <Link
        href="/forgot-password"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 text-sm text-primary"
      >
        Forgot password?
      </Link>
    </>
  );
}
