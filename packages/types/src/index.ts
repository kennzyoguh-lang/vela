// Shared TypeScript types, hand-written for Foundation. Once Phase 2 introduces
// the OpenAPI spec (Engineering Handbook Part 7.8), these become generated types
// and this file is replaced by the generator's output — do not hand-duplicate
// domain types once that pipeline exists.

export type Role = "owner" | "admin" | "accountant" | "staff" | "view_only";

// Business profiling — onboarding factor capture and per-module default
// visibility. Pure functions, not just types; see business-profile.ts for
// the full reasoning (why this is three independent factors, not a single
// formality tier).
export * from "./business-profile";

// GTM Channel 1 — FIRS penalty estimates. Shared so the number a visitor
// sees on the public calculator page and the number stored server-side on
// lead capture can never drift (same "one shared pure function" precedent
// as business-profile.ts's computeModuleDefaults).
export * from "./firs-penalty-calculator";

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

// Quick Sale / Instant Collect — an Invoice created by the amount-only
// walk-in-payment flow (see apps/api/prisma/schema.prisma's InvoiceSource
// comment) rather than the manual invoice-builder screen.
export type InvoiceSource = "manual" | "quick_sale";

export interface Invoice {
  id: string;
  orgId: string;
  number: string;
  // Nullable because a Quick Sale invoice has no client relationship at all
  // (see quick-sale.service.ts#createQuickSale) — every call site reading
  // this field must handle the walk-in-customer case.
  clientId: string | null;
  source: InvoiceSource;
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
  // Opt-in inventory tracking (value-add follow-up) — null means "not
  // tracked for this product," not zero stock.
  stockQuantity: number | null;
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
  discountAmount: string;
  currency: string;
  customerName: string | null;
  status: SaleStatus;
  voidedReason: string | null;
  soldAt: string;
  createdAt: string;
  items: SaleItem[];
}

// Anti-theft Piece 5 — sanitized shape returned by POST /v1/organisation/staff.
// generatedPin is present only when the caller omitted a PIN (the visual
// "Add Sales Staff" flow never collects one) — shown to the owner exactly
// once, same one-time-reveal treatment as a backup code or API key.
export interface StaffUserSummary {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  generatedPin?: string;
}

export type OwnerSummaryStatus = "matched" | "shortfall" | "overage" | "pending";

// Anti-theft accountability — sales and cash-handling accuracy reported
// side by side, deliberately never blended into one score (see
// apps/api/src/services/staff-leaderboard.service.ts's own comment).
export interface StaffLeaderboardEntry {
  staffUserId: string;
  staffName: string;
  salesCount: number;
  salesTotal: number;
  cashChecksCount: number;
  matchedCashChecksCount: number;
  totalShortfall: number;
  totalOverage: number;
}

export type ExpenseClaimCategory =
  "cost_of_goods" | "payroll" | "rent" | "utilities" | "marketing" | "transport" | "other_expense";

export type ExpenseClaimStatus = "pending" | "approved" | "rejected";

// Reimbursement tracking, not a P&L input — never reflected in the P&L
// statement (see apps/api/src/services/expense-claim.service.ts's own
// comment on why).
export interface ExpenseClaim {
  id: string;
  orgId: string;
  submittedByUserId: string;
  category: ExpenseClaimCategory;
  vendor: string;
  amount: string;
  currency: string;
  expenseDate: string;
  description: string | null;
  receiptFileId: string | null;
  status: ExpenseClaimStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  // Present only on the owner/admin org-wide listing, never on "my own
  // claims" (the viewer already knows who they are) — see
  // expense-claim.repository.ts#listAllByOrg.
  submittedByUser?: { name: string };
}

export interface ScannedReceipt {
  storedFileId: string;
  extracted: {
    vendor: string | null;
    amount: number | null;
    currency: string | null;
    date: string | null;
  } | null;
}

export interface OwnerDailySummary {
  salesCount: number;
  expectedAmount: number;
  countedAmount: number | null;
  difference: number | null;
  status: OwnerSummaryStatus;
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
  // Quick Sale / Instant Collect — true for an amount-only walk-in payment,
  // so the public checkout page can drop invoice-shaped copy (see
  // apps/web/app/pay/[token]/page.tsx).
  isQuickSale: boolean;
}

// === Quotes/Estimates (F-57) ===

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

export interface Quote {
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
  status: QuoteStatus;
  validUntil: string;
  portalToken: string;
  notes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQuoteView {
  number: string;
  total: string;
  subtotal: string;
  tax: string;
  discount: string;
  currency: string;
  validUntil: string;
  status: QuoteStatus;
  lineItems: LineItem[];
  notes: string | null;
  businessName?: string;
  clientName?: string;
}

// Quick Sale / Instant Collect Piece 2 — the entry-screen response. Narrower
// than Invoice (whose clientId several already-shipped invoice list/detail
// pages assume is always a non-null client id) rather than widening a type
// those screens depend on — transaction-history unification (Piece 5) is
// where those screens get taught about Quick Sale rows.
export interface QuickSaleResult {
  id: string;
  total: string;
  currency: string;
  paymentPortalToken: string;
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

// Nigeria Tax Act 2025 "small company" status (tax-status.service.ts) —
// "unknown" until the owner supplies all three raw inputs; never guessed.
export type SmallCompanyStatus = "small" | "standard" | "unknown";

export interface TaxStatus {
  annualTurnover: number | null;
  fixedAssetsValue: number | null;
  providesProfessionalServices: boolean | null;
  status: SmallCompanyStatus;
  citRate: number | null;
  summary: string;
}

// KYC — never includes the NIN/BVN itself, encrypted or otherwise, only
// whether each has been submitted and (once a real verification provider
// is wired) verified. See apps/api/src/services/kyc.service.ts's own
// comment on why "submitted" and "verified" are kept separate.
export interface KycStatus {
  ninSubmitted: boolean;
  ninVerified: boolean;
  bvnSubmitted: boolean;
  bvnVerified: boolean;
}

// GTM Channel 3 — computed on read from the conversion count, never stored
// (see apps/api/src/services/referral.service.ts#tierForConversionCount).
export type ReferralTier = "bronze" | "silver" | "gold" | "platinum";

export interface ReferralSummary {
  code: string;
  conversionCount: number;
  tier: ReferralTier;
  rewardsDescription: string[];
}

// GTM Channel 4 — an accounting firm's own org, read via the accountant
// portal. Tier reuses ReferralTier directly (see
// apps/api/src/services/accountant-earning.service.ts#getSummary).
export interface AccountantEarningsSummary {
  tier: ReferralTier;
  lifetimeReferralCount: number;
  monthlyHistory: Array<{
    month: string;
    referredCount: number;
    activeClientCount: number;
    amountOwed: number | null;
  }>;
}

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
  matchedInvoiceId: string | null;
  matchedAt: string | null;
}

// === Bank reconciliation (F-connectors adjacent — a business paid by direct
// bank transfer, not through Vela's own payment portal) ===

export type MatchConfidence = "exact" | "close";

export interface InvoiceMatchCandidate {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string | null;
  total: number;
  dueDate: string;
  confidence: MatchConfidence;
  daysFromDueDate: number;
}

export interface ReconciliationSuggestion {
  transactionId: string;
  amount: number;
  narration: string;
  transactionDate: string;
  candidates: InvoiceMatchCandidate[];
}

export interface PnlStatement {
  income: number;
  expensesByCategory: Partial<Record<TransactionCategory, number>>;
  totalExpenses: number;
  netProfit: number;
}

// F-33 — reported as a single "operating" bucket, not split into
// operating/investing/financing: TransactionCategory has no category that
// distinguishes investing/financing activity from ordinary operating income
// and expense (see cash-flow.service.ts's fuller comment on the backend).
export interface CashFlowStatement {
  periodLabel: string;
  operatingInflow: number;
  operatingOutflow: number;
  netCashFlow: number;
}

export interface CashFlowProjection {
  currentCashPosition: number;
  averageDailyNetCashFlow: number;
  projected30: number;
  projected60: number;
  historyDays: number;
  hasSufficientHistory: boolean;
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
  annualRentPaid: string;
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

// === Bring-your-own payment processor (F-connectors) ===

export type PaymentProcessor = "paystack" | "flutterwave" | "stripe";

// Never includes the secret key or its encrypted form in any shape — see
// apps/api/src/services/payment-credential.service.ts's own comment.
export interface PaymentCredentialSummary {
  id: string;
  processor: PaymentProcessor;
  publicKey: string | null;
  isActive: boolean;
  updatedAt: string;
}

// === Bring-your-own accounting app (F-connectors) ===

export type AccountingProvider = "quickbooks" | "xero" | "wave";

// Never includes any token or its encrypted form in any shape — see
// apps/api/src/services/accounting-connection.service.ts's own comment.
export interface AccountingConnectionSummary {
  id: string;
  provider: AccountingProvider;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

// === Generic third-party payroll webhook export (F-connectors) ===

// Never includes the signing secret — see
// apps/api/src/services/payroll-export.service.ts's own comment on why it
// is shown only once, at configure/regenerate time.
export interface PayrollExportConfigSummary {
  webhookUrl: string;
  isActive: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryError: string | null;
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
