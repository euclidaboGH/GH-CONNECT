import fs from 'node:fs'
import assert from 'node:assert/strict'
const root = new URL('../', import.meta.url)
const modules = ['community','chat','connections','matches','marketplace','orders','wallet','ghc','pi-payments','rewards','membership']
for (const name of modules) {
  const helper = new URL(`lib/active-upgrades/${name}.ts`, root)
  assert.ok(fs.existsSync(helper), `missing ${name} upgrade helpers`)
  assert.match(fs.readFileSync(helper, 'utf8'), /export function/, `${name} helper has no exported API`)
}
for (const name of ['matching','connections','orders','ghc','pi-payments']) {
  assert.ok(fs.existsSync(new URL(`features/${name}/index.ts`, root)), `missing ${name} feature entrypoint`)
}
const featureIndex = fs.readFileSync(new URL('features/index.ts', root), 'utf8')
for (const name of ['matching','connections','orders','ghc','pi-payments']) assert.ok(featureIndex.includes(`as ${name === 'pi-payments' ? 'piPayments' : name}`), `root feature export missing ${name}`)
console.log('Run #283 active-module wiring: 16/16 PASS')
