"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import type { User } from "@/types/domain";

export function AccountPreferences({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  useEffect(() => setName(user.name), [user.name]);

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    try {
      const response = await fetch("/api/super-admin/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      await redirectToLoginOnUnauthorized(response);
      if (!response.ok) {
        setNameMessage("Name was not saved. Check the name and try again.");
        return;
      }
      setNameMessage("Name saved.");
      router.refresh();
    } catch {
      setNameMessage("Name was not saved. Check the name and try again.");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        title="Profile and preferences"
        description="Manage your platform administrator identity and notification preferences."
      />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account identity for platform administration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={saveName}>
            <label className="text-sm font-medium">
              Display name
              <Input
                name="displayName"
                className="mt-1"
                autoComplete="name"
                maxLength={160}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Work email
              <Input className="mt-1" name="email" type="email" value={user.email} readOnly />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={savingName}>
                {savingName ? "Saving..." : "Save Name"}
              </Button>
              {nameMessage ? (
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {nameMessage}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Choose which platform alerts appear in your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                checked={deliveryAlerts}
                onChange={(event) => setDeliveryAlerts(event.target.checked)}
              />
              <span>
                <span className="block font-medium">
                  Show delivery-risk alerts
                </span>
                <span className="block text-muted-foreground">
                  Receive visible alerts when a tenant needs platform attention.
                </span>
              </span>
            </label>
            <div className="flex justify-end">
              <Button type="submit">Save preferences</Button>
            </div>
          </form>
          {saved ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Notification preferences are still saved locally for this demo.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
