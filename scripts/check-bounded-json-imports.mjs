import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('app/api')
const importPattern = /^\s*import\s*\{\s*readBoundedJson\s*\}\s*from\s*['"]@\/lib\/server\/http\/read-bounded-json['"]\s*;?\s*$/m
const failures = []
let routesChecked = 0

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }
    if (entry.name !== 'route.ts') continue
    const source = fs.readFileSync(fullPath, 'utf8')
    if (!source.includes('readBoundedJson(')) continue
    routesChecked += 1
    // Remove block comments before checking imports so an import accidentally
    // placed inside a route's leading documentation comment cannot pass.
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '')
    const imports = executableSource.match(new RegExp(importPattern.source, 'gm')) ?? []
    if (imports.length !== 1) failures.push(`${path.relative(process.cwd(), fullPath)}: expected exactly one executable readBoundedJson import; found ${imports.length}`)
  }
}

if (!fs.existsSync(root)) {
  console.error('bounded-json-imports: app/api directory not found')
  process.exit(1)
}
walk(root)
if (failures.length) {
  console.error(`bounded-json-imports: ${failures.length} failure(s) across ${routesChecked} route(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`bounded-json-imports: ok (${routesChecked} routes checked)`)
