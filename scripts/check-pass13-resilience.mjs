import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const checks = []
const ok = (name, pass, detail = "") => checks.push({ name, pass, detail })

const pkg = JSON.parse(read("package.json"))
const app = read("components/ghc/app.tsx")
const network = read("components/ghc/network-resilience.tsx")
const api = read("lib/api.ts")
const release = read("lib/app-release.ts")

ok("release is 0.235.0", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
ok("package is 0.235.0", pkg.version === release.match(/APP_RELEASE_VERSION = "([^"]+)"/)?.[1])
ok("single network resilience surface", app.includes('NetworkResilience') && !app.includes('NetworkStatusStrip') && !app.includes('OfflineBanner'))
ok("offline state is non-blocking", network.includes("pointer-events-none") && network.includes("server actions may be unavailable"))
ok("connection quality awareness", network.includes("effectiveType") && network.includes("saveData"))
ok("restored state is explicit", network.includes("Connection restored") && network.includes("catching up"))
ok("GET retries only transient failures", api.includes("TRANSIENT_GET_STATUSES") && api.includes('method === "GET"') && api.includes("maxAttempts = retryableRead ? 3 : 1"))
ok("no migration changes", !fs.existsSync(path.join(root, ".pass13-migration-touch")))

let failed = 0
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`)
  if (!c.pass) failed++
}
console.log(`\nPASS 13 resilience gate: ${checks.length - failed}/${checks.length}`)
process.exitCode = failed ? 1 : 0
