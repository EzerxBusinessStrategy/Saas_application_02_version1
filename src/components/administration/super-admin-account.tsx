"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ProfilePhotoEditor } from "@/components/shared/profile-photo-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  currentUserQueryKey,
  fetchCurrentUser,
  fetchCurrentUserContexts,
  type WorkspaceContext,
} from "@/features/identity/api/current-user-api";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Tenant Admin",
  TENANT_OWNER: "Tenant Owner",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  FINANCE_USER: "Finance",
  HR_OPERATIONS_USER: "HR Operations",
};

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  titles: z.record(z.string(), z.string()),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function SuperAdminAccountPage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: currentUserQueryKey("super-admin"),
    queryFn: () => fetchCurrentUser("super-admin"),
  });
  const contextsQuery = useQuery({
    queryKey: ["me-contexts", "super-admin"],
    queryFn: () => fetchCurrentUserContexts("super-admin"),
  });
  const organisations = useMemo(
    () => (contextsQuery.data ?? []).filter((context) => context.type === "tenant"),
    [contextsQuery.data],
  );
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "", phone: "", titles: {} },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    form.reset({
      displayName: profileQuery.data.user.displayName,
      phone: profileQuery.data.user.phone ?? "",
      titles: Object.fromEntries(
        organisations.flatMap((organisation) =>
          organisation.membershipId ? [[organisation.membershipId, organisation.displayTitle ?? ""]] : [],
        ),
      ),
    });
  }, [form, organisations, profileQuery.data]);

  const save = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (organisations.length === 0) {
        await patchProfile({ displayName: values.displayName, phone: values.phone });
        return;
      }
      for (const organisation of organisations) {
        await patchProfile({
          displayName: values.displayName,
          phone: values.phone,
          membershipId: organisation.membershipId,
          displayTitle: organisation.membershipId ? values.titles[organisation.membershipId] ?? "" : undefined,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey("super-admin") }),
        queryClient.invalidateQueries({ queryKey: ["me-contexts", "super-admin"] }),
      ]);
      toast.success("Profile saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (profileQuery.isPending || contextsQuery.isPending) {
    return <LoadingState label="Loading profile" rows={3} />;
  }
  if (profileQuery.isError || contextsQuery.isError) {
    return (
      <ErrorState
        title="Profile could not load"
        description="Try again to retrieve your Super Admin profile."
        onRetry={() => {
          void profileQuery.refetch();
          void contextsQuery.refetch();
        }}
      />
    );
  }

  const title = organisations.find((organisation) => organisation.displayTitle)?.displayTitle;

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="My profile"
        description="Your Super Admin identity stays separate from organisation roles."
      />
      <ProfilePhotoEditor portal="super-admin" />
      <form className="flex flex-col gap-[30px]" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <Card>
          <CardHeader>
            <CardTitle>{profileQuery.data.user.displayName}</CardTitle>
            <CardDescription>{title || "Platform Admin"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">
              Name
              <Input className="mt-1" {...form.register("displayName")} />
            </label>
            <label className="text-sm font-medium">
              Phone
              <Input className="mt-1" {...form.register("phone")} />
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>Your organisations and the roles assigned in each one.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</p>
              <p className="mt-1 text-sm">Super Admin</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organisations</p>
              {organisations.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">You are not a member of an organisation yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-4">
                  {organisations.map((organisation) => (
                    <OrganisationAccess
                      key={organisation.tenantId}
                      organisation={organisation}
                      register={form.register}
                    />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function OrganisationAccess({
  organisation,
  register,
}: {
  organisation: WorkspaceContext;
  register: ReturnType<typeof useForm<ProfileForm>>["register"];
}) {
  return (
    <li className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{organisation.tenantName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {organisation.roles.map((role) => roleLabels[role] ?? role).join(" · ")}
          </p>
        </div>
        <Link href="/super-admin/tenants" className="text-sm font-medium text-primary">
          Manage access
        </Link>
      </div>
      {organisation.membershipId ? (
        <label className="mt-3 block text-sm font-medium">
          Display title
          <Input className="mt-1" {...register(`titles.${organisation.membershipId}`)} />
        </label>
      ) : null}
    </li>
  );
}

async function patchProfile(body: {
  displayName: string;
  phone?: string;
  membershipId?: string;
  displayTitle?: string;
}): Promise<void> {
  const response = await fetch("/api/super-admin/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Your profile could not be saved.");
  }
}
