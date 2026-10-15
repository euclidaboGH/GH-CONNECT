import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { FlatCompat } from "@eslint/eslintrc"
import { defineConfig, globalIgnores } from "eslint/config"

/**
 * Flat config for Next 15. Prefer FlatCompat so `next/core-web-vitals` is always
 * a spreadable array — avoids "nextVitals is not iterable" when the package
 * export shape differs across installs.
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const nextConfigs = compat.extends("next/core-web-vitals")

export default defineConfig([
  ...nextConfigs,
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
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react/display-name": "warn",
      "import/no-anonymous-default-export": "warn",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
])
