import { Router } from "express";
import { authRouter } from "./auth.routes";
import { organisationRouter } from "./organisation.routes";
import { sessionRouter } from "./session.routes";
import { clientRouter } from "./client.routes";
import { invoiceRouter } from "./invoice.routes";
import { recurringInvoiceRouter } from "./recurring-invoice.routes";
import { paymentPortalRouter } from "./payment-portal.routes";

// URL path versioning (Handbook 7.4) — a breaking change gets /v2, never an
// in-place change to /v1.
export const v1Router = Router();
v1Router.use("/auth", authRouter);
v1Router.use("/organisation", organisationRouter);
v1Router.use("/sessions", sessionRouter);
v1Router.use("/clients", clientRouter);
v1Router.use("/invoices", invoiceRouter);
v1Router.use("/recurring-invoices", recurringInvoiceRouter);
// Public, unauthenticated — Design System 6.13's payment portal.
v1Router.use("/pay", paymentPortalRouter);
