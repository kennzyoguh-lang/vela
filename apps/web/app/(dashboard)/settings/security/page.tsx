"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UserSession } from "@vela/types";
import { api } from "@/lib/api/client";

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
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

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          {isLoading ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">Loading…</p>
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
