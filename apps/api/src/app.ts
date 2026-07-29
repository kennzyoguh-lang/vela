import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { requestId } from "./middleware/request-id.middleware";
import { errorHandler } from "./middleware/error-handler.middleware";
import { healthRouter } from "./routes/health.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { v1Router } from "./routes";
import { logger } from "./lib/logger";

export function createApp() {
  const app = express();

  // Helmet: HSTS, X-Frame-Options, X-Content-Type-Options (Handbook 8's header
  // baseline). CORS is locked to the configured web origin only.
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_APP_URL ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(requestId);
  app.use(pinoHttp({ logger, customProps: (req) => ({ requestId: req.res?.locals.requestId }) }));

  app.use(healthRouter);

  // Mounted BEFORE express.json() — webhook signature verification (Handbook
  // 5.9) needs the exact raw request bytes; webhookRouter applies its own
  // express.raw() body parser per-route (see routes/webhook.routes.ts).
  app.use("/webhooks", webhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Per-org rate limiting (Handbook 5.6) is applied inside each authenticated
  // router, immediately after requireAuth — org_id doesn't exist until the JWT
  // is verified, so it can't be enforced generically at this mount point.
  app.use("/v1", v1Router);

  // Error handler is registered last — Express only calls 4-arg middleware for
  // errors passed to next(), which is how every controller/service surfaces one.
  app.use(errorHandler);

  return app;
}
