"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserSession } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";

// Anti-theft Piece 4's staff-proof discount guardrail — a single PIN shared
// by owner/admin, not per-user (see apps/api's schema.prisma comment on
// Organisation.discountApprovalPinHash). A staff member asks whoever's on
// shift with owner/admin access to type this in on the POS device before a
// discount goes through.
function DiscountApprovalPinCard() {
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (value: string) =>
      api.patch("/v1/organisation/discount-approval-pin", { pin: value }),
    onSuccess: () => {
      setPin("");
      setSaved(true);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discount approval PIN</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Staff need this PIN to apply a discount on the sales screen — set it once, then share it
        only with the people who can approve a discount.
      </p>
      <form
        className="mt-3 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          mutation.mutate(pin);
        }}
      >
        <Input
          label="New PIN"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          helperText="4-6 digits"
        />
        <Button type="submit" loading={mutation.isPending} disabled={pin.length < 4}>
          Set PIN
        </Button>
      </form>
      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError ? mutation.error.message : "Couldn't set the PIN"
          }
        />
      ) : null}
      {saved ? <Alert variant="info" title="Discount approval PIN updated" /> : null}
    </Card>
  );
}

// Where the owner daily summary and cash-check mismatch alerts actually get
// sent (owner-summary.service.ts, cash-check.service.ts) — distinct from a
// staff member's phone+PIN login credential (Piece 1), this is just contact
// info for whoever's currently logged in as owner/admin.
function NotificationPhoneCard() {
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (value: string) =>
      api.patch("/v1/organisation/notification-phone", { phone: value }),
    onSuccess: () => setSaved(true),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification phone number</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Where your daily sales summary and cash-check mismatch alerts get sent by SMS.
      </p>
      <form
        className="mt-3 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          mutation.mutate(phone);
        }}
      >
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          helperText="e.g. 08012345678"
        />
        <Button type="submit" loading={mutation.isPending} disabled={phone.trim().length < 7}>
          Save phone number
        </Button>
      </form>
      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "Couldn't save this number"
          }
        />
      ) : null}
      {saved ? <Alert variant="info" title="Notification phone number updated" /> : null}
    </Card>
  );
}

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<UserSession[]>("/v1/sessions"),
    staleTime: 30_000, // fast-changing tier (Handbook 4.10)
  });

  const terminateMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/v1/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  return (
    <SettingsTemplate activePath="/settings/security">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Mandatory for the Owner role at first login (Handbook 8.3). Set-up flow: Settings →
            Security → Enable 2FA.
          </p>
        </Card>

        <NotificationPhoneCard />

        <DiscountApprovalPinCard />

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : sessionsError ? (
            <p className="font-ui text-status-danger text-[0.875rem]">
              Couldn&apos;t load — try again shortly.
            </p>
          ) : !sessions || sessions.length === 0 ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">No active sessions.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-ui text-text-primary text-[0.875rem]">
                      {session.deviceInfo ?? "Unknown device"}{" "}
                      {session.isCurrent ? "· This device" : ""}
                    </p>
                    <p className="font-ui text-text-secondary text-[0.75rem]">
                      {session.ipAddress ?? "Unknown IP"} · Last active{" "}
                      {new Date(session.lastActive).toLocaleString()}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => terminateMutation.mutate(session.id)}
                      loading={terminateMutation.isPending}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </SettingsTemplate>
  );
}
