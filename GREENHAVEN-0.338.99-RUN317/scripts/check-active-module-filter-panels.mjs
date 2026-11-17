#!/usr/bin/env node
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(path, "utf8")
const panel = read("components/ghc/filtering/filter-panel.tsx")
const community = read("components/ghc/communities-screen.tsx")
const messages = read("components/ghc/message-screen.tsx")
const matches = read("components/ghc/match-screen.tsx")
const connections = read("components/ghc/connection-request-inbox.tsx")
const marketplace = read("components/ghc/marketplace-screen.tsx")
const wallet = read("features/wallet/wallet-screen.tsx")
const rewards = read("components/ghc/rewards-centre-screen.tsx")
const membership = read("components/ghc/premium-membership-screen.tsx")
const registry = read("lib/navigation/service-registry.ts")

const checks = [
  ["shared filter panel is compact and explicitly collapsible on every viewport", panel.includes("defaultExpanded = false") && panel.includes("hidden={!expanded}") && panel.includes("aria-expanded={expanded}") && panel.includes("aria-controls={contentId}") && panel.includes("max-h-[min(52dvh,22rem)]") && panel.includes("max-h-[min(58dvh,26rem)]")],
  ["shared filter panel exposes live result counts and active-filter count", panel.includes('aria-live="polite"') && panel.includes("activeCount > 0")],
  ["community directory uses shared responsive filter workspace", community.includes('title="Explore communities"') && community.includes("resultCount={visibleGroups.length}")],
  ["GH Chat inbox uses shared responsive filter workspace", messages.includes('title="Refine your inbox"') && messages.includes("resultCount={list.length}")],
  ["Connections inbox supports tokenized search and removable filters", connections.includes("matchesFilterQuery(query") && connections.includes('ariaLabel="Active connection request filters"') && connections.includes('title="Filter connection requests"') && connections.includes("persistentContent={<label") ],
  ["Matches uses shared intention filter workspace", matches.includes('title="Refine your matches"') && matches.includes('ariaLabel="Active match filters"')],
  ["Marketplace listing facets use shared filter workspace", marketplace.includes('title="Refine the marketplace"') && marketplace.includes('ariaLabel="Active marketplace filters"')],
  ["Orders buyer/seller role facets use shared filter workspace", marketplace.includes('title="Filter your orders"') && marketplace.includes('ariaLabel="Active order filters"')],
  ["Wallet and GHC activity use the shared read-only filter workspace", wallet.includes('title="Filter GHC activity"') && wallet.includes('ariaLabel="Active wallet transaction filters"')],
  ["Pi Payments use separate lifecycle facets and preserve read-only intent history", wallet.includes('title="Filter Pi payment records"') && wallet.includes('ariaLabel="Active Pi payment filters"') && wallet.includes("piStatusFilter")],
  ["Rewards history uses the shared server-ledger filter workspace", rewards.includes('title="Filter reward history"') && rewards.includes('ariaLabel="Active reward filters"')],
  ["Membership tier explorer searches benefits without changing entitlements", membership.includes('title="Explore membership tiers"') && membership.includes("matchesFilterQuery(planSearch") && membership.includes('ariaLabel="Active membership filters"')],
  ["all eleven requested services remain Active in canonical registry", ["community", "gh-chat", "connections", "matches", "marketplace", "orders", "wallet", "ghc", "pi-payments", "rewards", "membership"].every((id) => new RegExp(`id: "${id}"[\\s\\S]{0,260}status: "ACTIVE"`).test(registry))],
  ["filter work does not add financial execution or payment mutations", !/createPayment\(|executeSpend\(|ledger\.insert|payment\.complete|settlePayment\(/.test(panel + connections + matches + wallet + rewards + membership)],
]

let failures = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`)
  if (!pass) failures += 1
}
console.log(`Active module filter panel contracts: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
