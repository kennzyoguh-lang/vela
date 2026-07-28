import { Router } from "express";
import { authRouter } from "./auth.routes";
import { organisationRouter } from "./organisation.routes";
import { sessionRouter } from "./session.routes";

// URL path versioning (Handbook 7.4) — a breaking change gets /v2, never an
// in-place change to /v1.
export const v1Router = Router();
v1Router.use("/auth", authRouter);
v1Router.use("/organisation", organisationRouter);
v1Router.use("/sessions", sessionRouter);
