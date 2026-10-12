import { spawnSync } from "child_process"
const strict = process.argv.includes("--strict")
console.log("=== Section E+F gates ===")
console.log("Compose single host, draft/offline/limits/alt, link preview, diversity, rejectMatch, search filters")
if (strict) {
  const r = spawnSync("npm", ["run", "test:feed-compose-ef"], { stdio: "inherit" })
  if (r.status !== 0) process.exit(1)
  console.log("STRICT E+F: PASS")
}
