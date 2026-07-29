import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The actual refresh token cookie (vela_refresh) is Path=/v1/auth-scoped on
// the API's own origin, so it's never attached to a page navigation request
// here — this marker cookie carries no secret, only "a session likely
// exists", and is set/cleared alongside it (apps/api/src/controllers/auth.controller.ts).
const SESSION_MARKER_COOKIE = "vela_has_session";
const AUTH_PATHS = ["/login", "/signup", "/2fa", "/reset-password"];

// First line of defense-in-depth (Handbook 4.3) — checks the session marker is
// present before the route even renders. This is NOT a signature/expiry check
// (that needs Node's crypto, not the Edge runtime); the API independently
// re-validates the access token on every request regardless, per Handbook 8.1.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_MARKER_COOKIE);
  const isAuthPath = AUTH_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));

  if (!hasSession && !isAuthPath) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isAuthPath) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
