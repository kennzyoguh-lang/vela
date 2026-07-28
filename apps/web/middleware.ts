import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REFRESH_COOKIE = "vela_refresh";
const AUTH_PATHS = ["/login", "/signup", "/2fa", "/reset-password"];

// First line of defense-in-depth (Handbook 4.3) — checks the refresh cookie is
// present before the route even renders. This is NOT a signature/expiry check
// (that needs Node's crypto, not the Edge runtime); the API independently
// re-validates the access token on every request regardless, per Handbook 8.1.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(REFRESH_COOKIE);
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
