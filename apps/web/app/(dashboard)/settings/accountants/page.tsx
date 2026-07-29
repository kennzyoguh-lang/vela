"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { api, ApiError } from "@/lib/api/client";

interface AccountantLink {
  id: string;
  accountantEmail: string;
  status: "pending" | "active" | "revoked";
  invitedAt: string;
  respondedAt: string | null;
}

const STATUS_BADGE: Record<AccountantLink["status"], { status: BadgeStatus; label: string }> = {
  pending: { status: "draft", label: "Pending" },
  active: { status: "active", label: "Active" },
  revoked: { status: "archived", label: "Revoked" },
};

export default function AccountantsSettingsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["organisation", "accountant-links"],
    queryFn: () => api.get<AccountantLink[]>("/v1/organisation/accountant-links"),
    staleTime: 5 * 60_000,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post("/v1/organisation/accountant-links", { email }),
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["organisation", "accountant-links"] });
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't send the invite."),
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/v1/organisation/accountant-links/${linkId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["organisation", "accountant-links"] }),
  });

  return (
    <SettingsTemplate activePath="/settings/accountants">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Invite an accountant</CardTitle>
          </CardHeader>
          {formError ? <Alert variant="danger" title={formError} /> : null}
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Invited accountants get read-only access to a summary of your invoices, compliance
            deadlines, cash position, and payroll — from their own Accountant Portal login.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Input
                label="Accountant's email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={inviteMutation.isPending}>
              Send invite
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked accountants</CardTitle>
          </CardHeader>
          {isLoading ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">Loading…</p>
          ) : !links || links.length === 0 ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">
              No accountants invited yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-ui text-text-primary text-[0.875rem]">
                      {link.accountantEmail}
                    </p>
                    <Badge {...STATUS_BADGE[link.status]} />
                  </div>
                  {link.status !== "revoked" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(link.id)}
                      loading={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </SettingsTemplate>
  );
}
