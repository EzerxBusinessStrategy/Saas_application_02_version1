import Image from "next/image";
import { BadgeCheck, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OperationalNetwork } from "@/components/auth/operational-network";
import { cn } from "@/lib/utils";

const valuePoints = [
  "Centralised administration",
  "Secure role-based access",
  "Built for multi-team operations",
];

export function AuthScreenLayout({
  children,
  cardClassName,
}: {
  children: React.ReactNode;
  cardClassName?: string;
}) {
  return (
    <div className="min-h-[100dvh] bg-muted lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
      <aside className="login-brand-panel relative hidden overflow-hidden px-10 py-10 text-sidebar-foreground lg:flex lg:h-[100dvh] lg:flex-col xl:px-14">
        <OperationalNetwork />
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/branding/default-mark.svg" alt="" width={34} height={34} priority />
          <span className="text-xl font-bold tracking-tight">SaaS App</span>
        </div>
        <div className="relative z-10 my-auto max-w-xl py-16">
          <p className="text-sm font-semibold tracking-[0.16em] text-sidebar-muted uppercase">Operations workspace</p>
          <h1 className="mt-5 max-w-lg text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">Secure operations for modern enterprises</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-sidebar-muted">Manage teams, services, compliance workflows and support operations through one secure workspace.</p>
          <ul className="mt-10 space-y-4 text-sm font-medium">
            {valuePoints.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="grid size-5 place-items-center rounded-full border border-sidebar-border bg-sidebar-active/50">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2 text-xs font-medium text-sidebar-muted">
          <TrustLabel icon={ShieldCheck} label="SSO Ready" />
          <TrustLabel icon={BadgeCheck} label="MFA Supported" />
          <TrustLabel icon={LockKeyhole} label="Role-Based Access" />
        </div>
      </aside>

      <main className="auth-right-panel flex min-h-[100dvh] flex-col bg-[#f8f9ff] px-4 py-6 sm:px-8 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:px-10 lg:py-4 xl:px-16">
        <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 lg:hidden">
          <Image src="/branding/default-mark.svg" alt="SaaS App" width={28} height={28} priority />
          <span className="font-bold tracking-tight">SaaS App</span>
        </div>
        <div className="mx-auto flex w-full max-w-[480px] flex-1 items-center py-8 sm:py-12 lg:py-4">
          <Card className={cn("login-form-enter w-full rounded-2xl border-border/80 shadow-[var(--shadow-card)]", cardClassName)}>
            {children}
          </Card>
        </div>
        <footer className="relative mx-auto flex w-full max-w-[480px] flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[#687899]">
          <span>Privacy</span><span>Terms</span><span>Help</span><span>System status</span>
          <span className="size-1.5 self-center rounded-full bg-emerald-500" aria-label="System operational" />
        </footer>
      </main>
    </div>
  );
}

function TrustLabel({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border px-2.5 py-1.5"><Icon className="size-3.5" aria-hidden="true" />{label}</span>;
}
