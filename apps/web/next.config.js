/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vela/design-tokens", "@vela/types"],
  experimental: {
    // Route-level code splitting is automatic via the App Router (Handbook
    // 4.10); heavy per-module libraries are dynamically imported per-module,
    // not configured globally here.
  },
  // Proxies /v1/* to the API as a same-origin path when the API is deployed
  // on a different domain (e.g. Render) than the web app (e.g. Vercel).
  // Session cookies (session-cookies.ts) are httpOnly + SameSite=Strict with
  // no explicit Domain, so they're scoped to whichever origin the browser
  // sees in the response — direct cross-origin API calls would set them on
  // the API's own domain, invisible to this app's middleware.ts, which reads
  // them from the request it receives on ITS OWN domain. Routing everything
  // through this same-origin proxy is what makes the cookie visible to
  // middleware. Local dev doesn't need this (both run on localhost, same
  // site for cookie purposes) — only applies when API_PROXY_TARGET is set.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [{ source: "/v1/:path*", destination: `${target}/v1/:path*` }];
  },
  // Static, non-request-dependent security headers. The Content-Security-Policy
  // itself is set per-request in middleware.ts instead (it needs a fresh nonce
  // per request for the inline theme-init script), so it isn't listed here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
