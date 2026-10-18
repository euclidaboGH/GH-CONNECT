import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : ""
let passed = 0, failed = 0
function check(ok, name) {
  if (ok) { passed++; console.log(`✓ ${name}`) }
  else { failed++; console.error(`✗ ${name}`) }
}
const route = read("app/api/economy/transfers/route.ts")
const publicId = read("lib/server/economy/public-id.ts")
const contract = read("lib/domains/economy-transfer-contract.ts")
const domain = read("lib/domains/economy-domain.ts")
const sendUi = read("components/ghc/send-ghc-flow.tsx")
const resolver = read("app/api/economy/public-id/resolve/route.ts")
const walletUi = read("features/wallet/wallet-screen.tsx")
check(route.includes("resolvePublicIdentity(normalizeGreenHavenId(rawGreenHavenId))"), "authoritative transfer route resolves the public GreenHaven ID server-side")
check(route.includes("GREENHAVEN_ID_REQUIRED") && route.includes("isValidGreenHavenIdFormat(rawGreenHavenId)"), "transfer route rejects missing or malformed GreenHaven IDs")
check(route.includes("const toUserId = recipient.userId"), "transfer destination comes from the resolved directory, not client-supplied internal ID")
check(route.includes("const toUserName = recipient.displayName || \"GreenHaven member\""), "recipient display name is server-derived")
check(contract.includes("toGreenHavenId: string") && contract.includes("toGreenHavenId: intent.toGreenHavenId"), "HTTP transfer contract sends a public ID, not an account destination")
check(domain.includes("toGreenHavenId,") && domain.includes("deriveGreenHavenId(recipientInput)"), "server-mode domain builds the public ID transfer intent")
check(publicId.includes("return await rpcEnsure(") && publicId.includes("return await rpcResolve(id)"), "configured database identity operations fail closed when RPC fails")
check(publicId.includes("Fail closed outside explicitly enabled local/test memory mode") && publicId.includes("return null"), "production identity service does not mint ephemeral memory identities")
check(sendUi.includes("resolveGreenHavenIdServer(id, directory)") && sendUi.includes("resolveGreenHavenIdServer(lookupId, directory)") && sendUi.includes("GH-XXXXXX"), "send UI validates manual IDs and verifies directory recipients before review")
check(sendUi.includes("toGreenHavenId: recipient.greenHavenId || deriveGreenHavenId(recipient.id)"), "send UI passes the resolved public ID into the economy domain")
check(resolver.includes("resolvePublicIdentity(id)"), "public directory endpoint uses the same canonical resolver")
check(walletUi.includes("isValidGreenHavenIdFormat(id)") && walletUi.includes("toGreenHavenId: resolved.publicId"), "wallet quick-transfer flow validates and sends the resolved GreenHaven ID")
console.log(`\nGreenHaven ID transfer checks: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
