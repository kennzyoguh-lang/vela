import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The actual refresh token cookie (vela_refresh) is Path=/v1/auth-scoped on
// the API's own origin, so it's never attached to a page navigation request
// here — this marker cookie carries no secret, only "a session likely
// exists", and is set/cleared alongside it (apps/api/src/controllers/auth.controller.ts).
const SESSION_MARKER_COOKIE = "vela_has_session";
const AUTH_PATHS = ["/login", "/signup", "/2fa", "/reset-password"];
// Genuinely public routes — no session required, and unlike AUTH_PATHS, an
// already-logged-in visitor is never redirected away from them either. /pay
// is the invoice payment link an SME's own customer opens; it was missing
// from any allowlist, so every unauthenticated visitor — the entire intended
// audience — was being bounced to /login, where they have no account.
const PUBLIC_PATHS = ["/pay"];

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Nonce-based CSP (Next.js's own documented pattern) rather than 'unsafe-inline'
// on script-src — the root layout's inline theme-init script (avoids a
// dark-mode flash of unstyled content) is the one legitimate inline script in
// the app, and it reads this nonce back out via next/headers. style-src keeps
// 'unsafe-inline' since Next.js/Tailwind don't yet support nonced styles.
//
// 'unsafe-eval' is added in development ONLY — Next.js's dev-mode webpack
// bundle uses eval() internally for Fast Refresh/module execution, and
// without it the entire client bundle silently fails to hydrate (no console
// error, just a page that looks static and never becomes interactive —
// found by discovering a useQuery never fired its queryFn). Production
// builds don't use eval-based devtool, so prod keeps the strict policy.
function buildCsp(nonce: string): string {
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${API_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// First line of defense-in-depth (Handbook 4.3) — checks the session marker is
// present before the route even renders. This is NOT a signature/expiry check
// (that needs Node's crypto, not the Edge runtime); the API independently
// re-validates the access token on every request regardless, per Handbook 8.1.
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const hasSession = req.cookies.has(SESSION_MARKER_COOKIE);
  const isAuthPath = AUTH_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const isPublicPath = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  let response: NextResponse;
  if (!hasSession && !isAuthPath && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    response = NextResponse.redirect(loginUrl);
  } else if (hasSession && isAuthPath) {
    response = NextResponse.redirect(new URL("/", req.url));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
