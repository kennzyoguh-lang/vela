// Shared TypeScript types, hand-written for Foundation. Once Phase 2 introduces
// the OpenAPI spec (Engineering Handbook Part 7.8), these become generated types
// and this file is replaced by the generator's output — do not hand-duplicate
// domain types once that pipeline exists.

export type Role = "owner" | "admin" | "accountant" | "staff" | "view_only";

// Shared envelope for paginated list endpoints (invoices, clients, bank
// transactions) — a bare array response was returning every row in the org
// unbounded; every paginated list endpoint now returns this shape instead.
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

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
  // Nullable as of the phone+PIN staff-auth feature — a sales-staff user has
  // phone instead of email.
  email: string | null;
  phone: string | null;
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

// === Anti-theft / Sales Tracking, Piece 1: Simple Sale Logging ===

export interface Product {
  id: string;
  orgId: string;
  name: string;
  price: string; // Prisma Decimal serializes as a string over JSON
  currency: string;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export type SaleStatus = "completed" | "voided";

export interface Sale {
  id: string;
  orgId: string;
  staffUserId: string;
  total: string;
  currency: string;
  customerName: string | null;
  status: SaleStatus;
  soldAt: string;
  createdAt: string;
  items: SaleItem[];
}

export interface CashReconciliation {
  id: string;
  orgId: string;
  staffUserId: string;
  businessDate: string;
  expectedAmount: string;
  countedAmount: string;
  difference: string;
  matched: boolean;
  currency: string;
  createdAt: string;
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

// === P&L Intelligence (Phase 4) ===

export type BankSyncProvider = "mono" | "okra";
export type TransactionType = "credit" | "debit";
export type TransactionCategory =
  | "income"
  | "cost_of_goods"
  | "payroll"
  | "rent"
  | "utilities"
  | "marketing"
  | "transport"
  | "other_expense"
  | "transfer"
  | "uncategorized";

export interface BankAccount {
  id: string;
  orgId: string;
  provider: BankSyncProvider;
  institutionName: string;
  accountType: string;
  accountNumberMasked: string;
  currency: string;
  currentBalance: string; // Prisma Decimal serializes as a string over JSON
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  orgId: string;
  bankAccountId: string;
  type: TransactionType;
  amount: string;
  category: TransactionCategory;
  categorizedManually: boolean;
  narration: string;
  transactionDate: string;
  createdAt: string;
}

export interface PnlStatement {
  income: number;
  expensesByCategory: Partial<Record<TransactionCategory, number>>;
  totalExpenses: number;
  netProfit: number;
}

// === PeopleHub (Phase 5) ===

export type EmploymentType = "full_time" | "part_time" | "contract";
export type PayrollRunStatus = "draft" | "paid";

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  jobTitle: string;
  employmentType: EmploymentType;
  basicSalary: string; // Prisma Decimal serializes as a string over JSON
  housingAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  startDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payslip {
  id: string;
  orgId: string;
  payrollRunId: string;
  employeeId: string;
  grossPay: string;
  paye: string;
  employeePension: string;
  employerPension: string;
  nhf: string;
  netPay: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  orgId: string;
  periodLabel: string;
  status: PayrollRunStatus;
  runDate: string;
  totalGrossPay: string;
  totalDeductions: string;
  totalNetPay: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[];
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
