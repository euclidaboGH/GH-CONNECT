import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "pnpm-lock.yaml"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
]

export default config
