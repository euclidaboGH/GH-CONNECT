import fs from 'node:fs'
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const missing = []
for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const name of Object.keys(pkg[group] || {})) {
    const lockKey = `node_modules/${name}`
    if (!lock.packages?.[lockKey]) missing.push(`${group}.${name} -> ${lockKey}`)
  }
}
if (pkg.version !== lock.version || pkg.version !== lock.packages?.['']?.version) missing.push(`root version mismatch: package=${pkg.version}, lock=${lock.version}, lock.root=${lock.packages?.['']?.version}`)
if (missing.length) {
  console.error('Dependency lock is incomplete. Do not run a production deployment or delete the lockfile.')
  for (const item of missing) console.error(`MISSING ${item}`)
  console.error('On a registry-connected supported Node runtime, run: npm install --package-lock-only --legacy-peer-deps')
  process.exit(1)
}
console.log('Dependency lock coverage and root version are consistent.')
