// Module augmentation, not a separate `AuthenticatedRequest` interface — Express's
// `RequestHandler` type is invariant on `req`, so a handler typed to require a
// narrower/extended Request than Express actually provides fails to type-check
// when registered via `router.get/post/use`. Augmenting `Express.Request`
// directly is the standard fix: every Request optionally carries these fields,
// populated by requireAuth (middleware/auth.middleware.ts) once verified.
// Controllers narrow "optional" to "definitely present" via
// `lib/auth-context.ts#getAuthContext`, which also re-checks at runtime that
// requireAuth actually ran before this handler — defense in depth, not just a cast.
export {};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      orgId?: string;
      role?: string;
      sessionFamilyId?: string;
    }
  }
}
