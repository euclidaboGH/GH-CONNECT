#!/usr/bin/env node
/** Run #317: prevent Node-only crypto from entering shared browser modules. */
import fs from "node:fs"

const read = (path) => fs.readFileSync(path, "utf8")
const secure = read("lib/secure-id.ts")
const transactions = read("lib/transactions.ts")
const data = read("lib/ghc-data.ts")
const pushContract = read("lib/notification-push-contract.ts")
const pushHash = read("lib/server/notifications/push-hash.ts")
const pushArchitecture = read("lib/server/notifications/push-architecture.ts")
const stripComments = (value) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
const executableSecure = stripComments(secure)
const transactionImport = /import \{ securePrefixedId \} from ("[^"\n]+")/.exec(transactions)?.[1]
const dataImport = /import \{ secureHex \} from ("[^"\n]+")/.exec(data)?.[1]
const expectedLocalModule = "." + "/" + "secure-id.ts"
const checks = [
  ["shared secure ID helper has no Node crypto import or require", !/node:crypto|require\s*\(/.test(secure)],
  ["secure ID helper uses global Web Crypto", /globalThis\.crypto/.test(secure) && /getRandomValues/.test(secure)],
  ["UUID fallback sets RFC 4122 v4 and variant bits", /bytes\[6\].*&\s*0x0f/.test(secure) && /bytes\[8\].*&\s*0x3f/.test(secure)],
  ["secure ID helper fails closed without secure randomness", /SECURE_RANDOM_UNAVAILABLE/.test(secure) && !/Math\.random/.test(executableSecure)],
  ["transaction coordinator statically imports browser-safe ID helper", transactionImport === JSON.stringify(expectedLocalModule) && !/require\s*\(/.test(transactions)],
  ["shared GHC data statically imports browser-safe ID helper", dataImport === JSON.stringify(expectedLocalModule) && !/require\s*\(/.test(data)],
  ["shared ID call sites do not downgrade to Math.random", !/Math\.random/.test(stripComments(transactions.slice(transactions.indexOf("protected generateId")))) && !/Math\.random/.test(stripComments(data.slice(data.indexOf("export function generateId"))))],
  ["push endpoint contract remains free of Node-only crypto", !/node:crypto|require\s*\(/.test(pushContract)],
  ["Node crypto endpoint hashing is isolated to server-only module", /node:crypto/.test(pushHash) && /from "@\/lib\/server\/notifications\/push-hash"/.test(pushArchitecture)],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failures += 1
}
console.log(`Run #317 browser-safe crypto boundary: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
