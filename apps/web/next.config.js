/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vela/design-tokens", "@vela/types"],
  experimental: {
    // Route-level code splitting is automatic via the App Router (Handbook
    // 4.10); heavy per-module libraries are dynamically imported per-module,
    // not configured globally here.
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
