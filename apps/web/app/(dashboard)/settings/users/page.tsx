"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Briefcase, Check } from "lucide-react";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { StaffUserSummary } from "@vela/types";
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
  { value: "staff", label: "Sales Staff — self-service HR" },
  { value: "view_only", label: "View-only — read access" },
];

type StaffRole = "staff" | "admin";

const ROLE_CARDS: {
  role: StaffRole;
  label: string;
  description: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    role: "staff",
    label: "Sales Staff",
    description: "Logs sales, checks cash",
    icon: ShoppingBag,
  },
  { role: "admin", label: "Manager", description: "Approves discounts too", icon: Briefcase },
];

function RoleCard({
  option,
  selected,
  onSelect,
}: {
  option: (typeof ROLE_CARDS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-transform active:scale-[0.98]",
        selected ? "border-action-primary bg-action-primary/5" : "border-border bg-surface-raised",
      )}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          selected
            ? "bg-action-primary text-action-primaryText"
            : "bg-surface-secondary text-text-secondary",
        )}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      <span className="font-ui text-text-primary text-[0.9375rem] font-bold">{option.label}</span>
      <span className="font-ui text-text-secondary text-[0.75rem]">{option.description}</span>
      {selected ? (
        <span className="text-action-primary flex items-center gap-1 text-[0.75rem] font-semibold">
          <Check className="size-3.5" aria-hidden /> Selected
        </span>
      ) : null}
    </button>
  );
}

// Anti-theft Piece 5 — "keep it to: name, phone number, and a role picker
// shown as two big illustrated cards... rather than a technical permissions
// checklist." No PIN field at all: organisation.service.ts#createStaffUser
// generates one and returns it once, shown here right after creation.
function AddSalesStaffCard() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole | null>(null);
  const [created, setCreated] = useState<StaffUserSummary | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<StaffUserSummary>("/v1/organisation/staff", { name, phone, role: role ?? "staff" }),
    onSuccess: (staff) => {
      setCreated(staff);
      setName("");
      setPhone("");
      setRole(null);
      setFormError(null);
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : "Couldn't add this staff member."),
  });

  if (created) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff added</CardTitle>
        </CardHeader>
        <p className="font-ui text-text-primary text-[0.9375rem]">
          {created.name} can now log in at the sales screen with their phone number.
        </p>
        {created.generatedPin ? (
          <div className="bg-surface-secondary mt-3 rounded-lg p-4 text-center">
            <p className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
              Their PIN — write it down, this is shown only once
            </p>
            <p className="font-data text-text-primary mt-1 text-[2rem] font-bold tracking-widest">
              {created.generatedPin}
            </p>
          </div>
        ) : null}
        <Button className="mt-3" onClick={() => setCreated(null)}>
          Add another
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add sales staff</CardTitle>
      </CardHeader>
      {formError ? <Alert variant="danger" title={formError} /> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex-1">
            <Input
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_CARDS.map((option) => (
            <RoleCard
              key={option.role}
              option={option}
              selected={role === option.role}
              onSelect={() => setRole(option.role)}
            />
          ))}
        </div>
        <Button
          type="submit"
          disabled={!name || !phone || !role}
          loading={mutation.isPending}
          className="self-start"
        >
          Add staff
        </Button>
      </form>
    </Card>
  );
}

export default function UsersSettingsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [formError, setFormError] = useState<string | null>(null);

  // Slow-changing data — 5 minute stale time (Handbook 4.10's tiering).
  const {
    data: invites,
    isLoading,
    error: invitesError,
  } = useQuery({
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

        <AddSalesStaffCard />

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : invitesError ? (
            <p className="font-ui text-status-danger text-[0.875rem]">
              Couldn&apos;t load — try again shortly.
            </p>
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
