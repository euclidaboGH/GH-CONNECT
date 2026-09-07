import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
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
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Keep production builds green; tighten gradually in CI-only strict mode
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react/display-name": "warn",
      "import/no-anonymous-default-export": "warn",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      // rules-of-hooks stays error — real bugs
      "react-hooks/rules-of-hooks": "error",
    },
  },
]

export default eslintConfig
