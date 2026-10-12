import fs from "node:fs"

const checks = []
const check = (name, pass) => checks.push({ name, pass: Boolean(pass) })
const app = fs.readFileSync("components/ghc/app.tsx", "utf8")
const hostPath = "components/ghc/global-compose-host.tsx"
const host = fs.readFileSync(hostPath, "utf8")
const feed = fs.readFileSync("components/ghc/enhanced-feed-screen.tsx", "utf8")
const composer = fs.readFileSync("components/ghc/post-composer.tsx", "utf8")

check("global composer host is mounted in app shell", /<GlobalComposeHost\s*\/>/.test(app) && /from "\.\/global-compose-host"/.test(app))
check("global host owns the open-compose event", /addEventListener\("ghc:open-compose"/.test(host))
check("global host handles post and story modes", /detail\?\.mode === "story" \? "story" : "post"/.test(host))
check("global host removes listeners on unmount", /removeEventListener\("ghc:open-compose"/.test(host) && /removeEventListener\("ghc:close-transient-ui"/.test(host))
check("global host delegates to the canonical unified composer", /<PostComposer open=\{open\}/.test(host) && /UnifiedCompose/.test(composer))
check("feed no longer owns a second composer event listener", !/addEventListener\("ghc:open-compose"/.test(feed) && !/<PostComposer/.test(feed))
check("composer still closes on tab changes", /addEventListener\("ghc:tab-change", handleClose\)/.test(host))

for (const item of checks) console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`)
const failed = checks.filter((item) => !item.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) process.exitCode = 1
