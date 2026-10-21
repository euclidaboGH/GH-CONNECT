#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createEvidenceTemplate, validateEvidenceManifest } from "./lib/release-evidence.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function usage() {
  console.log(`GreenHaven Testnet release evidence validator\n\nUsage:\n  node scripts/validate-release-evidence.mjs --template <path>\n  node scripts/validate-release-evidence.mjs --validate <manifest.json>\n\nValidation is offline. It never deploys, connects to providers, or changes remote infrastructure.`)
}

function main(args) {
  const mode = args[0]
  const targetArg = args[1]
  if (!mode || mode === "--help" || mode === "-h") { usage(); return 0 }
  if (!targetArg || !["--template", "--validate"].includes(mode)) { usage(); return 2 }
  const target = resolve(process.cwd(), targetArg)
  if (mode === "--template") {
    mkdirSync(dirname(target), { recursive: true })
    try {
      const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
      const nodeVersion = readFileSync(resolve(root, ".nvmrc"), "utf8").trim()
      writeFileSync(target, `${JSON.stringify(createEvidenceTemplate({ packageVersion: pkg.version, nodeVersion }), null, 2)}\n`, { flag: "wx" })
    } catch (error) {
      if (error?.code === "EEXIST") {
        console.error("Refusing to overwrite an existing evidence packet. Choose a new path or back up the file first.")
        return 2
      }
      throw error
    }
    console.log(`Created blocked-by-default Testnet evidence template: ${target}`)
    console.log("This template is not approval. Replace placeholders with reviewed, hashed evidence and run --validate.")
    return 0
  }
  let manifest
  try { manifest = JSON.parse(readFileSync(target, "utf8")) }
  catch (error) { console.error(`Cannot read valid JSON evidence manifest: ${error.message}`); return 2 }
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
  const result = validateEvidenceManifest(manifest, { manifestPath: target, expectedPackageVersion: pkg.version })
  for (const error of result.errors) console.error(`BLOCKED ${error}`)
  if (result.valid) {
    console.log(`APPROVED evidence packet: ${result.passedGates}/${result.requiredGates} required gates passed; target is Testnet Preview only.`)
    return 0
  }
  console.log(`NOT APPROVED: ${result.passedGates}/${result.requiredGates} required gates marked passed; ${result.errors.length} issue(s) remain.`)
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)) }
  catch (error) { console.error(`Evidence validator failed safely: ${error.message}`); process.exitCode = 2 }
}

export { main }
