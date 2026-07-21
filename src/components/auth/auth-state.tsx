import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthState({
  title,
  description,
  action,
  icon = "alert",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: "alert" | "permission";
}) {
  const Icon = icon === "permission" ? ShieldAlert : CircleAlert;
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Icon
            className="mx-auto size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle className="mt-3">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="mt-6">
            {action ?? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-primary px-[15px] text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Return to sign in
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
