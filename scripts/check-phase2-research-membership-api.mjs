import fs from 'node:fs'
const read = (path) => fs.readFileSync(path, 'utf8')
const collection = read('app/api/research/projects/[id]/members/route.ts')
const member = read('app/api/research/projects/[id]/members/[memberId]/route.ts')
const checks = [
  ['membership APIs use the canonical authenticated-user resolver', (collection + member).includes('from "@/lib/server/economy/auth"')],
  ['member list requires authenticated project owner', /resolveAuthenticatedUser/.test(collection) && /owner_user_id=eq\./.test(collection)],
  ['invitation creation requires authenticated project owner', /ownedProject\(id, auth\.userId\)/.test(collection)],
  ['only least-privilege non-owner roles can be invited', /new Set\(\["editor", "reviewer", "field_agent"\]\)/.test(collection)],
  ['duplicate active or pending invitations cannot be silently overwritten', /MEMBER_ALREADY_INVITED_OR_ACTIVE/.test(collection) && /prior\.status !== "revoked"/.test(collection)],
  ['revoked membership can only be re-invited through a revoked-status guarded update', /status=eq\.revoked/.test(collection)],
  ['membership actions are bounded and rate limited', /readBoundedJson\(request, 2 \* 1024\)/.test(member) && /checkDurableRateLimit/.test(member)],
  ['invitee can only accept their own pending invitation', /isInvitee && action === "accept"/.test(member) && /member\.status !== "invited"/.test(member)],
  ['invitation acceptance uses a conditional status update to prevent revoke/accept races', /statusGuard = action === "accept" \? "&status=eq\.invited"/.test(member)],
  ['only project owner can revoke, suspend, reactivate or change roles', /if \(!isOwner && !\(isInvitee && action === "accept"\)\)/.test(member)],
  ['database failures are surfaced as unavailable instead of false not-found responses', /if \(!memberResult\.ok\)[\s\S]*?status: 503/.test(member) && /if \(!ownerResult\.ok\)[\s\S]*?status: 503/.test(member)],
  ['membership endpoints use private no-store responses', /private, no-store/.test(collection) && /private, no-store/.test(member)],
  ['membership routes do not grant direct client database access', !/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]{0,80}\b(?:anon|authenticated)\b/i.test(collection + member)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 2 research membership API: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
