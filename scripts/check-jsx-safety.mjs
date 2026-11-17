/**
 * Fail CI/build when known-bad JSX patterns ship (e.g. attributes after self-close /).
 * Catches the Feed "Unexpected token ... &gt;" class of bugs.
 */
import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative, dirname } from "path"
import { fileURLToPath } from "url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC_DIRS = ["components", "app", "contexts", "lib", "features", "hooks"]
const EXTS = new Set([".tsx", ".jsx", ".ts", ".js"])

const RULES = [
  {
    name: "img-attrs-after-self-close",
    // <img ... / loading=  OR  ... / decoding=
    re: /<\s*img\b[^>]*\s\/\s+(loading|decoding)=/i,
    message: 'Broken <img />: attributes after "/". Use <img ... loading="lazy" decoding="async" />',
  },
  {
    name: "any-tag-attrs-after-self-close",
    re: /<\s*[A-Za-z][\w.-]*\b[^>]*\s\/\s+[a-zA-Z-]+=/,
    message: 'Self-closing tag has attributes after "/". Move attributes before "/>".',
  },
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else {
      const dot = name.lastIndexOf(".")
      if (dot >= 0 && EXTS.has(name.slice(dot))) out.push(p)
    }
  }
  return out
}

const files = []
for (const d of SRC_DIRS) {
  walk(join(ROOT, d), files)
}

let failed = 0
for (const file of files) {
  const text = readFileSync(file, "utf8")
  const lines = text.split(/\r?\n/)
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.re.test(lines[i])) {
        failed++
        const rel = relative(ROOT, file)
        console.error(`[jsx-safety] ${rule.name} @ ${rel}:${i + 1}`)
        console.error(`  ${rule.message}`)
        console.error(`  ${lines[i].trim().slice(0, 160)}`)
      }
    }
  }
}

if (failed > 0) {
  console.error(`\njsx-safety: ${failed} issue(s). Fix before build.`)
  process.exit(1)
}
console.log(`jsx-safety: ok (${files.length} files scanned)`)
