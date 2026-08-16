"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getTenantProfile, updateTenantProfile } from "@/features/operations/api/operations-api";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function TenantSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["tenant-profile"], queryFn: getTenantProfile });
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const profile = query.data;
  const draftName = name ?? profile?.name ?? "";

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await updateTenantProfile(draftName);
      setName(saved.name);
      queryClient.setQueryData(["tenant-profile"], saved);
      toast.success("Organisation profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Organisation profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Profile and preferences"
        description="Update the organisation name shown in the tenant workspace."
      />
      {query.isPending ? <LoadingState label="Loading organisation profile" rows={2} /> : null}
      {query.isError ? <ErrorState title="Organisation profile could not load" onRetry={() => void query.refetch()} /> : null}
      {profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Organisation profile</CardTitle>
            <CardDescription>Currency and timezone stay as configured for this tenant.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-w-xl gap-5">
            <label className="text-sm font-medium">
              Organisation name
              <Input className="mt-1" value={draftName} onChange={(event) => setName(event.target.value)} minLength={2} required />
            </label>
            <p className="text-sm text-muted-foreground">Currency {profile.currencyCode} · Timezone {profile.timezone}</p>
            <div className="flex justify-end">
              <Button disabled={saving || draftName.trim().length < 2} onClick={() => void save()}>
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
