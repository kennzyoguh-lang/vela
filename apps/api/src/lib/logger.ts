import pino from "pino";

// Structured JSON logging with a requestId correlating to the client-facing
// requestId (Handbook Part 7.6 / 11.4) — never log PII.
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
