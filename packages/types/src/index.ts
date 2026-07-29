// Shared TypeScript types, hand-written for Foundation. Once Phase 2 introduces
// the OpenAPI spec (Engineering Handbook Part 7.8), these become generated types
// and this file is replaced by the generator's output — do not hand-duplicate
// domain types once that pipeline exists.

export type Role = "owner" | "admin" | "accountant" | "staff" | "view_only";

export interface Organisation {
  id: string;
  name: string;
  industry: string | null;
  baseCurrency: string;
  country: string;
  subscriptionTier: "starter" | "growth" | "enterprise" | "corporate";
  subscriptionStatus: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  twoFaEnabled: boolean;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActive: string;
  isActive: boolean;
  isCurrent: boolean;
}

// === SmartInvoice™ (Phase 2) ===

export type InvoiceStatus =
  "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "written_off" | "void";

export interface Client {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: number;
  avgPaymentDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  number: string;
  clientId: string;
  lineItems: LineItem[];
  subtotal: string; // Prisma Decimal serializes as a string over JSON
  tax: string;
  discount: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  riskScore: number | null;
  paymentPortalToken: string;
  notes: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicInvoiceView {
  number: string;
  total: string;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  businessName?: string;
  clientName?: string;
}

// === ComplianceRadar™ (Phase 3) ===

export type ComplianceObligationType =
  "vat" | "paye" | "pension" | "wht" | "cit" | "cac_annual_return";

export type ComplianceFrequency = "monthly" | "annual";

export interface ComplianceObligation {
  type: ComplianceObligationType;
  label: string;
  authority: string;
  frequency: ComplianceFrequency;
  description: string;
  isActive: boolean;
}

export type FilingStatus = "upcoming" | "due_soon" | "overdue" | "filed";

export interface ComplianceFiling {
  id: string;
  orgId: string;
  obligationType: ComplianceObligationType;
  periodLabel: string;
  dueDate: string;
  filedAt: string | null;
  receiptReference: string | null;
  notes: string | null;
  status: FilingStatus; // computed server-side (compliance.service.ts), never stored
  createdAt: string;
  updatedAt: string;
}

/** API response envelope — Engineering Handbook Part 7.6. Uniform for every endpoint. */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      meta?: { page?: number; limit?: number; total?: number; cursor?: string; requestId: string };
    }
  | {
      success: false;
      error: { code: string; message: string; details?: unknown; requestId: string };
    };
