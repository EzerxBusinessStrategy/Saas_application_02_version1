"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { listTenants, resetTenantAdministratorPassword } from "@/features/administration/api/administration-api";

export function TenantPasswordPage() {
  const [tenantId, setTenantId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const tenantsQuery = useQuery({
    queryKey: ["tenant-password-tenants", submittedSearch],
    queryFn: () => listTenants({ page: 1, pageSize: 100, sort: "name", query: submittedSearch || undefined }),
  });
  const resetMutation = useMutation({
    mutationFn: () => resetTenantAdministratorPassword(tenantId, password),
    onSuccess: (result) => {
      setPassword("");
      setConfirmation("");
      setMessage(`Password updated for ${result.email}.`);
    },
  });

  if (tenantsQuery.isLoading) return <LoadingState label="Loading tenants" rows={3} />;
  if (!tenantsQuery.data) {
    return <ErrorState title="Tenant passwords could not load" description="Check the backend connection and try again." onRetry={() => void tenantsQuery.refetch()} />;
  }

  const canSubmit = tenantId && password.length >= 8 && password === confirmation && !resetMutation.isPending;
  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader eyebrow="Super Admin" eyebrowIcon={ShieldCheck} title="Tenant password" description="Set a new password for a tenant's active Tenant Administrator." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-5" aria-hidden="true" />Set Tenant Administrator password</CardTitle>
          <CardDescription>The password is sent directly to Supabase Auth and cannot be viewed after saving.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex gap-2">
            <Input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSubmittedSearch(tenantSearch.trim()); } }} placeholder="Search tenant name or code" aria-label="Search tenant" />
            <Button type="button" variant="outline" onClick={() => setSubmittedSearch(tenantSearch.trim())}>Search</Button>
          </div>
          <form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); setMessage(null); if (canSubmit) resetMutation.mutate(); }}>
            <label className="text-sm font-medium">Tenant
              <Select className="mt-1" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
                <option value="">Select tenant</option>
                {tenantsQuery.data.items.filter((tenant) => tenant.status === "active").map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.code})</option>)}
              </Select>
            </label>
            <label className="text-sm font-medium">New password
              <Input className="mt-1" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </label>
            <label className="text-sm font-medium">Confirm new password
              <Input className="mt-1" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />
            </label>
            {confirmation && password !== confirmation ? <p className="text-sm text-danger">Passwords do not match.</p> : null}
            {resetMutation.error ? <p className="text-sm text-danger">{resetMutation.error.message}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
            <div><Button type="submit" disabled={!canSubmit}>{resetMutation.isPending ? "Updating..." : "Update password"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
