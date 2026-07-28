"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { api, ApiError } from "@/lib/api/client";

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin — full access minus billing" },
  { value: "accountant", label: "Accountant — read + export" },
  { value: "staff", label: "Staff — self-service HR" },
  { value: "view_only", label: "View-only — read access" },
];

export default function UsersSettingsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [formError, setFormError] = useState<string | null>(null);

  // Slow-changing data — 5 minute stale time (Handbook 4.10's tiering).
  const { data: invites, isLoading } = useQuery({
    queryKey: ["organisation", "invites"],
    queryFn: () => api.get<PendingInvite[]>("/v1/organisation/invites"),
    staleTime: 5 * 60_000,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post("/v1/organisation/invites", { email, role }),
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["organisation", "invites"] });
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't send the invite."),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => api.delete(`/v1/organisation/invites/${inviteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organisation", "invites"] }),
  });

  return (
    <SettingsTemplate activePath="/settings/users">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
          </CardHeader>
          {formError ? <Alert variant="danger" title={formError} /> : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="role"
                className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]"
              >
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" loading={inviteMutation.isPending}>
              Send invite
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          {isLoading ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">Loading…</p>
          ) : !invites || invites.length === 0 ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">No pending invites.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-ui text-text-primary text-[0.875rem]">{invite.email}</p>
                    <p className="font-ui text-text-secondary text-[0.75rem]">{invite.role}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(invite.id)}
                    loading={revokeMutation.isPending}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </SettingsTemplate>
  );
}
