import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const revenue = readFileSync(new URL('../lib/server/revenue/revenue-event.ts', import.meta.url), 'utf8')
assert.match(revenue, /supabaseUrl\.replace\(\/\\\/\$\/, ""\)/, 'Revenue endpoint must remove one trailing slash with valid TypeScript regex syntax')
assert.match(revenue, /rest\/v1\/rpc\/gh_company_revenue_event_append/, 'Revenue RPC endpoint must remain intact')

for (const path of ['../.github/workflows/ci.yml', '../.github/workflows/repair-npm-lock.yml']) {
  const workflow = readFileSync(new URL(path, import.meta.url), 'utf8')
  assert.match(workflow, /runs-on: ubuntu-24\.04/, `${path}: use pinned Ubuntu 24.04 runner, not moving ubuntu-latest label`)
  assert.match(workflow, /actions\/checkout@v6/, `${path}: use Node 24-compatible checkout action`)
  assert.match(workflow, /actions\/setup-node@v7/, `${path}: use Node 24-compatible setup-node action`)
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v[34]/, `${path}: stale Node 20 action runtime reference remains`)
}

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /actions\/upload-artifact@v7/, 'CI artifact uploads must use Node 24-compatible action')
const repair = readFileSync(new URL('../.github/workflows/repair-npm-lock.yml', import.meta.url), 'utf8')
assert.match(repair, /peter-evans\/create-pull-request@v8/, 'Lock repair workflow must use Node 24-compatible pull request action')

console.log('GitHub push fixes: all assertions passed')
