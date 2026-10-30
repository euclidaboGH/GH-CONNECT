/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    /**
     * Production builds must fail on TypeScript errors.
     * Run `npm run typecheck` in CI before deploy. Do not re-enable ignoreBuildErrors.
     */
    ignoreBuildErrors: false,
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
      // Some hosts / previews request /index.html
      {
        source: "/index.html",
        destination: "/",
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
        // Long-cache hashed static assets from Next. Deployment-wide security
        // headers are owned by vercel.json to avoid duplicate CSP policies.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default nextConfig
