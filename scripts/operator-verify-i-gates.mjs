import { spawnSync } from "child_process"
const strict = process.argv.includes("--strict")
console.log("=== Section I gates ===")
if (strict) {
  const r = spawnSync("npm", ["run", "test:observability-i"], { stdio: "inherit" })
  if (r.status !== 0) process.exit(1)
  console.log("STRICT I: PASS")
}
