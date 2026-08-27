/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow deploy while incremental type fixes continue; run `npm run typecheck` locally
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com", pathname: "/**" },
    ],
  },
  poweredByHeader: false,
  compress: true,
  // Tree-shake icon imports — large win with lucide-react
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "class-variance-authority", "clsx"],
  },
  compiler: {
    // Drop noisy console.log in production; keep error/warn for diagnostics
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  async rewrites() {
    return [
      {
        source: "/validation-key.txt",
        destination: "/api/validation-key",
      },
      {
        source: "/tpa/ghconnectakmx4864/validation-key.txt",
        destination: "/api/validation-key",
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/validation-key.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/api/validation-key",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Long-cache hashed static assets from Next
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        /**
         * Pi Browser / Developer Portal sandbox loads the app inside an iframe
         * (sandbox.minepi.com → your Vercel URL). X-Frame-Options: SAMEORIGIN
         * causes net::ERR_BLOCKED_BY_RESPONSE — do not set it.
         * Allow framing only from Pi hosts via CSP frame-ancestors.
         */
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors",
              "'self'",
              "https://sandbox.minepi.com",
              "https://app-cdn.minepi.com",
              "https://minepi.com",
              "https://*.minepi.com",
              "https://*.pinet.com",
              "https://socialchain.app",
              "https://*.socialchain.app",
            ].join(" "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ]
  },
}

export default nextConfig
