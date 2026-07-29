"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";

export interface AccountantLinkSummary {
  id: string;
  orgId: string;
  orgName: string;
  status: "pending" | "active" | "revoked";
  invitedAt: string;
  respondedAt: string | null;
}

const STATUS_BADGE: Record<
  AccountantLinkSummary["status"],
  { status: BadgeStatus; label: string }
> = {
  pending: { status: "draft", label: "Pending" },
  active: { status: "active", label: "Active" },
  revoked: { status: "archived", label: "Revoked" },
};

// One row per linked/pending client org — mirrors InvoiceCard.tsx's "one
// thing per card" precedent.
export function AccountantLinkCard({
  link,
  onAccept,
  accepting,
}: {
  link: AccountantLinkSummary;
  onAccept?: (linkId: string) => void;
  accepting?: boolean;
}) {
  return (
    <Card className="flex flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Building2 className="text-text-secondary size-5" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-ui text-text-primary text-[0.875rem] font-semibold">{link.orgName}</p>
          <Badge {...STATUS_BADGE[link.status]} />
        </div>
      </div>
      {link.status === "pending" && onAccept ? (
        <Button size="sm" onClick={() => onAccept(link.id)} loading={accepting}>
          Accept
        </Button>
      ) : link.status === "active" ? (
        <Link href={`/accountant-portal/${link.orgId}`}>
          <Button variant="secondary" size="sm">
            View summary
          </Button>
        </Link>
      ) : null}
    </Card>
  );
}
