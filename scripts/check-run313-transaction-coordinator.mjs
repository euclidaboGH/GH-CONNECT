import { readFileSync } from 'node:fs'
const source = readFileSync('lib/transactions.ts', 'utf8')
const restore = readFileSync('contexts/ghc-context.tsx', 'utf8')
const checks = [
  ['transaction operations require real executors', /typeof operation\.execute !== "function"/.test(source)],
  ['rollback invokes compensators in reverse order', /\[\.\.\.transaction\.operations\]\.reverse\(\)/.test(source) && /await operation\.compensate\(\)/.test(source)],
  ['failed commit records rollback or failed compensation', /transaction\.status = rollbackOk \? "rolled_back" : "failed"/.test(source)],
  ['transaction history lookup includes completed records', /completedTransactions\.find\(\(item\) => item\.id === transactionId\)/.test(source)],
  ['transaction manager explicitly excludes financial authority', /must never be used as the[\s\S]*?authority for wallets, payments, rewards, orders, or entitlements/.test(source)],
  ['backup restore validates snapshot arrays before mutation', /!Array\.isArray\(snapshotData\.posts\)[\s\S]*?!Array\.isArray\(snapshotData\.conversations\)/.test(restore)],
  ['backup restore applies all domains in one state update', /setState\(\(current\) => \(\{[\s\S]*?profile: snapshotData\.profile[\s\S]*?settings: snapshotData\.settings[\s\S]*?posts: snapshotData\.posts[\s\S]*?conversations: snapshotData\.conversations/.test(restore)],
  ['backup restore no longer relies on a fake in-memory atomicity wrapper', !restore.includes('transactionManager.executeTransaction') && !restore.includes('from "@/lib/transactions"')],
]
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
console.log(`Run 313 transaction coordinator source gate: ${checks.filter(([, ok]) => ok).length}/${checks.length}`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
