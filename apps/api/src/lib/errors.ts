// Typed domain errors — Handbook 5.10. Services throw these, never raw strings
// or generic Error, so the centralized error-handling middleware can map them to
// the correct HTTP status/error code without services knowing about HTTP at all.
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = "Missing or invalid credentials") {
    super(message, "UNAUTHENTICATED", 401);
  }
}

export class InsufficientPermissionError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message, "BUSINESS_RULE_VIOLATION", 422);
  }
}

// Distinct from InsufficientPermissionError (a role problem) — this is a
// verification-status problem, so the frontend can tell the two apart and
// show "verify your email" rather than a generic access-denied message.
export class EmailNotVerifiedError extends DomainError {
  constructor(message = "Please verify your email address to do this") {
    super(message, "EMAIL_NOT_VERIFIED", 403);
  }
}

export class RateLimitedError extends DomainError {
  constructor(
    message = "Too many requests",
    public readonly retryAfterSeconds?: number,
  ) {
    super(message, "RATE_LIMITED", 429);
  }
}
