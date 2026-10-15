import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals.js"

/**
 * Use the flat-config entry point with an explicit .js extension. Node ESM resolution on the deployed Next 15 package requires this file suffix.
 * This lets Next.js detect its plugin reliably during production builds.
 */
export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "dist/**",
    "public/**",
    "scripts/**",
    "supabase/**",
    "docs/**",
    "*.config.js",
    "*.config.mjs",
  ]),
  {
    rules: {
      // Keep production builds green; tighten gradually in CI-only strict mode.
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react/display-name": "warn",
      "import/no-anonymous-default-export": "warn",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      // rules-of-hooks stays error — real bugs.
      "react-hooks/rules-of-hooks": "error",
    },
  },
])
