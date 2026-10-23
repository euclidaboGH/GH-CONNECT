import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = []
const assert = (name, ok) => { checks.push([name, Boolean(ok)]); if (!ok) throw new Error(`FAIL: ${name}`) }

const migration = read('supabase/migrations/20261023010002_ghc_wallet_v2_authoritative_snapshot.sql')
const route = read('app/api/economy/wallet/summary/route.ts')
const provider = read('contexts/domains/wallet-read-provider.tsx')
const seam = read('lib/domains/adapters/wallet-read-seam.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const v2 = read('lib/domains/wallet-v2.ts')

assert('wallet v2 migration exists', migration.includes('ghc_wallet_v2_snapshot'))
assert('available derived from spendable balance', migration.includes('ghc_spendable_balance(v_user)'))
assert('pending derived from ledger', migration.includes("status = 'pending' AND amount > 0"))
assert('locked distinguished from escrow', migration.includes("'escrowLocked', v_escrow") && migration.includes("'withdrawalLocked'"))
assert('escrow is explicit not fabricated', migration.includes("v_escrow := 0") && migration.includes("'escrowRail', 'not_configured'"))
assert('reconciliation is server-side', migration.includes('availablePlusLockedEqualsLedger'))
assert('category attribution exists', migration.includes("'creator'") && migration.includes("'curation'") && migration.includes("'marketplace'"))
assert('service role only RPC', migration.includes('GRANT EXECUTE ON FUNCTION public.ghc_wallet_v2_snapshot(text) TO service_role'))
assert('wallet summary endpoint authenticates', route.includes('resolveAuthenticatedUser'))
assert('wallet summary endpoint calls v2 RPC', route.includes('ghc_wallet_v2_snapshot'))
assert('wallet summary no-store', route.includes('Cache-Control') && route.includes('no-store'))
assert('wallet v2 client no local balance synthesis', v2.includes('/api/economy/wallet/summary') && !v2.includes('localStorage'))
assert('wallet read provider consumes server snapshot', provider.includes('fetchWalletV2') && provider.includes('wallet.available'))
assert('wallet read seam exposes categories', seam.includes('WalletV2Categories') && seam.includes('escrowLocked'))
assert('wallet UI has authoritative refresh path', wallet.includes('eco?.refresh?.()') && wallet.includes('socialEconomyStatus'))
assert('no client financial mutations in read provider', provider.includes('canMutateFinances: false'))
assert('canonical installer includes new migration', read('supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql').includes('20261023010002_ghc_wallet_v2_authoritative_snapshot.sql'))

console.log(`PHASE 28 WALLET ECONOMY V2 — ${checks.length}/${checks.length} checks passed`)
