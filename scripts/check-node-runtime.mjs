#!/usr/bin/env node
/** Fail fast when the project is run outside its explicitly supported Node.js ranges. */

const suppliedIndex = process.argv.indexOf('--version')
const version = suppliedIndex >= 0 ? process.argv[suppliedIndex + 1] : process.version

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value ?? '')
  return match ? match.slice(1).map(Number) : null
}

function isSupported(value) {
  const parsed = parseVersion(value)
  if (!parsed) return false
  const [major, minor, patch] = parsed
  return major === 24 && (minor > 15 || (minor === 15 && patch >= 0))
}

if (!isSupported(version)) {
  console.error(`Unsupported Node.js runtime: ${version}`)
  console.error('GH-CONNECT requires Node.js ^24.15.0. Switch to the pinned version in .nvmrc before installing dependencies, typechecking, or building.')
  process.exit(1)
}

console.log(`Node.js runtime supported: ${version}`)
