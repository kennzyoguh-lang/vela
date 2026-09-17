import { Router } from "express";
import { publicRouter } from "./public.routes";
import { authRouter } from "./auth.routes";
import { staffAuthRouter } from "./staff-auth.routes";
import { organisationRouter } from "./organisation.routes";
import { sessionRouter } from "./session.routes";
import { clientRouter } from "./client.routes";
import { invoiceRouter } from "./invoice.routes";
import { recurringInvoiceRouter } from "./recurring-invoice.routes";
import { quoteRouter } from "./quote.routes";
import { quotePortalRouter } from "./quote-portal.routes";
import { paymentPortalRouter } from "./payment-portal.routes";
import { complianceRouter } from "./compliance.routes";
import { bankAccountRouter } from "./bank-account.routes";
import { bankTransactionRouter } from "./bank-transaction.routes";
import { pnlRouter } from "./pnl.routes";
import { cashFlowRouter } from "./cash-flow.routes";
import { employeeRouter } from "./employee.routes";
import { payrollRouter } from "./payroll.routes";
import { accountantPortalRouter } from "./accountant-portal.routes";
import { askVelaRouter } from "./ask-vela.routes";
import { productRouter } from "./product.routes";
import { saleRouter } from "./sale.routes";
import { cashCheckRouter } from "./cash-check.routes";
import { ownerSummaryRouter } from "./owner-summary.routes";
import { quickSaleRouter } from "./quick-sale.routes";
import { dataExportRouter } from "./data-export.routes";
import { paymentCredentialRouter } from "./payment-credential.routes";
import { accountingConnectionRouter } from "./accounting-connection.routes";
import { accountingConnectionCallbackRouter } from "./accounting-connection-callback.routes";
import { payrollExportRouter } from "./payroll-export.routes";
import { staffLeaderboardRouter } from "./staff-leaderboard.routes";
import { receiptRouter } from "./receipt.routes";

// URL path versioning (Handbook 7.4) — a breaking change gets /v2, never an
// in-place change to /v1.
export const v1Router = Router();
// Public, unauthenticated — mounted first since it needs no auth context at
// all, same precedent as /pay below but for the GTM-engine's marketing-site
// endpoints (Channel 1: FIRS penalty calculator lead capture).
v1Router.use("/public", publicRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/auth/staff", staffAuthRouter);
v1Router.use("/organisation", organisationRouter);
v1Router.use("/sessions", sessionRouter);
v1Router.use("/clients", clientRouter);
v1Router.use("/invoices", invoiceRouter);
v1Router.use("/recurring-invoices", recurringInvoiceRouter);
v1Router.use("/quotes", quoteRouter);
v1Router.use("/compliance", complianceRouter);
v1Router.use("/bank-accounts", bankAccountRouter);
v1Router.use("/bank-transactions", bankTransactionRouter);
v1Router.use("/pnl", pnlRouter);
v1Router.use("/cash-flow", cashFlowRouter);
v1Router.use("/employees", employeeRouter);
v1Router.use("/payroll-runs", payrollRouter);
v1Router.use("/accountant-portal", accountantPortalRouter);
v1Router.use("/ask-vela", askVelaRouter);
v1Router.use("/products", productRouter);
v1Router.use("/sales", saleRouter);
v1Router.use("/cash-checks", cashCheckRouter);
v1Router.use("/owner-summary", ownerSummaryRouter);
v1Router.use("/quick-sales", quickSaleRouter);
v1Router.use("/data-export", dataExportRouter);
v1Router.use("/payment-credentials", paymentCredentialRouter);
v1Router.use("/accounting-connections", accountingConnectionRouter);
v1Router.use("/payroll-export-config", payrollExportRouter);
v1Router.use("/staff-leaderboard", staffLeaderboardRouter);
v1Router.use("/receipts", receiptRouter);
// Public, unauthenticated — Design System 6.13's payment portal.
v1Router.use("/pay", paymentPortalRouter);
// Public, unauthenticated — same shape as /pay above, for quotes (F-57).
v1Router.use("/quote-portal", quotePortalRouter);
// Public, unauthenticated — QuickBooks/Xero redirect the browser straight
// here after OAuth consent. Deliberately NOT nested under
// /accounting-connections (mounted above with requireAuth applied to
// every path under that prefix, callback included, which would 401 the
// provider's own redirect before it ever reached this handler) — same
// "separate top-level path, not a sub-path" precedent as /pay vs /invoices.
v1Router.use("/accounting-callback", accountingConnectionCallbackRouter);
