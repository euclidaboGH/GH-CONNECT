import { spawnSync } from "child_process"
const strict = process.argv.includes("--strict")
console.log("=== Section G+H gates ===")
if (strict) {
  const r = spawnSync("npm", ["run", "test:messaging-marketplace-gh"], { stdio: "inherit" })
  if (r.status !== 0) process.exit(1)
  console.log("STRICT G+H: PASS")
}
