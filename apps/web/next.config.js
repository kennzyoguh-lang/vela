/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vela/design-tokens", "@vela/types"],
  experimental: {
    // Route-level code splitting is automatic via the App Router (Handbook
    // 4.10); heavy per-module libraries are dynamically imported per-module,
    // not configured globally here.
  },
};

module.exports = nextConfig;
