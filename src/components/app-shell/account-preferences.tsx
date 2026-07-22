"use client";

import { useState } from "react";
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
import type { User } from "@/types/domain";

export function AccountPreferences({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

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
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Display name
              <Input
                className="mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Work email
              <Input className="mt-1" value={user.email} readOnly />
            </label>
          </div>
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
              Preferences saved locally for this demo. Server-side account
              persistence will be connected when the identity API is available.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
