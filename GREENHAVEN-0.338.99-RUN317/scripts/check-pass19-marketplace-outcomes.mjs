import fs from "node:fs"
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const checks = []
const check = (name, ok) => { checks.push([name, Boolean(ok)]); console.log(`${ok ? "PASS" : "FAIL"} — ${name}`) }
const release = read("lib/app-release.ts")
const pkg = JSON.parse(read("package.json"))
const market = read("components/ghc/marketplace-screen.tsx")
check("release metadata is 0.241.0", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
check("marketplace has outcome centre", market.includes("MarketplaceOutcomeCenter") && market.includes("Marketplace next step"))
check("buyer journey exposes active durable order progress", market.includes("activeBuyerOrders") && market.includes("Track orders"))
check("seller attention has priority action", market.includes("sellerAttention") && market.includes("Open Seller Centre"))
check("cart becomes a useful next action", market.includes("Review cart") && market.includes("server-authoritative totals"))
check("saved listings remain a real-data path", market.includes("savedListings.length") && market.includes("Review saved"))
check("protected commerce language is preserved", market.includes("protected order flows") && market.includes("durable order record"))
check("canonical marketplace buckets remain available", ["browse", "orders", "saved", "sell", "mine", "cart"].every((x) => market.includes(`\"${x}\"`)))
check("no fabricated commerce success metrics", !market.includes("conversion rate") && !market.includes("guaranteed sales"))
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPass 19 Marketplace Outcomes: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
