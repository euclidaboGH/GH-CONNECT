import fs from 'node:fs'
import assert from 'node:assert/strict'

const barrel = fs.readFileSync('features/orders/index.ts', 'utf8')
const upgrades = fs.readFileSync('lib/active-upgrades/orders.ts', 'utf8')
const lifecycle = fs.readFileSync('lib/marketplace/order-lifecycle.ts', 'utf8')

function exportedNames(source) {
  const names = new Set()
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1])
  }
  return names
}

function explicitReexports(source) {
  const entries = []
  for (const match of source.matchAll(/export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    entries.push({ names, modulePath: match[2] })
  }
  return entries
}

const sources = {
  '@/lib/active-upgrades/orders': exportedNames(upgrades),
  '@/lib/marketplace/order-lifecycle': exportedNames(lifecycle),
}
let checked = 0
for (const entry of explicitReexports(barrel)) {
  const available = sources[entry.modulePath]
  assert.ok(available, `Unexpected orders barrel module: ${entry.modulePath}`)
  for (const name of entry.names) {
    assert.ok(available.has(name), `${entry.modulePath} does not export ${name}`)
    checked++
  }
}
assert.match(barrel, /export\s*\*\s*from\s*["']@\/lib\/marketplace\/order-lifecycle["']/)
console.log(`RUN369 orders barrel export contract: ${checked} named exports PASS; lifecycle wildcard preserved`)
