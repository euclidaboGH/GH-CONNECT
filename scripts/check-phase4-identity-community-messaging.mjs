#!/usr/bin/env node
/** Phase 4 coordinated identity, community directory, and messenger controls. */
import fs from 'node:fs'
import path from 'node:path'
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const readFirstExisting = (...files) => {
  const file = files.find((candidate) => fs.existsSync(path.join(process.cwd(), candidate)))
  if (!file) throw new Error(`Required source file not found: ${files.join(' or ')}`)
  return read(file)
}
const proposal = read('supabase/proposals/20261118_phase4_identity_group_contact.sql')
const session = read('lib/server/identity/session-store.ts')
const stepUp = read('app/api/auth/step-up/route.ts')
const groupCreate = read('app/api/messaging/conversations/group/route.ts')
const groupInvites = read('app/api/messaging/group-invites/route.ts')
const groupInviteResponse = read('app/api/messaging/group-invites/[inviteId]/route.ts')
const contactShare = read('app/api/messaging/conversations/[conversationId]/contacts/route.ts')
const directory = read('app/api/communities/[id]/members/route.ts')
const hub = read('components/ghc/premium-community-hub.tsx')
const communityScreen = read('components/ghc/communities-screen.tsx')
const messageScreen = read('components/ghc/message-screen.tsx')
const messageComponents = read('components/ghc/message-components.tsx')
const context = read('contexts/ghc-context.tsx')
const invitePanel = read('components/ghc/group-invites-panel.tsx')
const phase4Doc = readFirstExisting(
  'docs/RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING-2026-11-18.md',
  'docs/archive/historical-implementation-records/docs__RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING-2026-11-18.md'
)
const packageScripts = JSON.parse(read('package.json')).scripts
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }

test('durable session cap is serialized with a per-user advisory transaction lock and opt-in flag', /gh_session_issue_with_cap/.test(session) && /pg_advisory_xact_lock\(hashtextextended\(p_gh_user_id, 0\)\)/.test(proposal) && /GHC_ATOMIC_SESSION_CAP_RPC_ENABLED/.test(session))
test('session issue RPC is service-role only with pinned search path', /REVOKE ALL ON FUNCTION public\.gh_session_issue_with_cap/.test(proposal) && /TO service_role/.test(proposal) && /SET search_path = pg_catalog, public, pg_temp/.test(proposal))
test('step-up rotates session before proof creation', stepUp.indexOf('rotateSession({') >= 0 && stepUp.indexOf('rotateSession({') < stepUp.indexOf('createStepUp({'))
test('step-up failure preserves rotated session cookie without granting elevation', /if \(rotatedSession\) response\.headers\.append\("Set-Cookie"/.test(stepUp) && /sessionRotated: Boolean\(rotatedSession\)/.test(stepUp))

test('group creation derives actor from authenticated session', /resolveAuthenticatedUser/.test(groupCreate) && /auth\.source !== \"gh_session\"/.test(groupCreate) && /p_actor_id: auth\.userId/.test(groupCreate) && !/body\.actorId|body\.userId|body\.createdBy/.test(groupCreate))
test('group creation has bounded input, stable idempotency key and fail-closed rate limit', /readBoundedJson\(request, 8 \* 1024\)/.test(groupCreate) && /clientRequestId/.test(groupCreate) && /p_client_request_id: clientRequestId/.test(groupCreate) && /onUnavailable: "deny"/.test(groupCreate) && /socialDbConfigured\(\)/.test(groupCreate))
test('group creation requires an existing direct-thread source', /c\.kind = 'direct'/.test(proposal) && /SOURCE_CONVERSATION_FORBIDDEN/.test(proposal))
test('group creation validates known identities and reciprocal blocks', /gh_pi_identities/.test(proposal) && /ghc_user_blocks/.test(proposal) && /BLOCKED_PARTICIPANT/.test(proposal))
test('new group starts with creator only and invitees remain pending', /VALUES \(p_group_id, p_actor_id, 'owner'\)/.test(proposal) && /gh_conversation_invites/.test(proposal) && /status text NOT NULL DEFAULT 'pending'/.test(proposal))
test('group creation retries are exact-payload idempotent', /uq_gh_conversations_creator_request/.test(proposal) && /pg_advisory_xact_lock\(hashtextextended\(p_actor_id \|\| ':' \|\| p_client_request_id, 0\)\)/.test(proposal) && /IDEMPOTENCY_CONFLICT/.test(proposal))
test('group membership count is trigger-synchronized on join/leave/removal', /gh_messaging_sync_member_count/.test(proposal) && /AFTER INSERT OR UPDATE OF left_at, conversation_id OR DELETE/.test(proposal))
test('group invite table denies direct browser access', /ALTER TABLE public\.gh_conversation_invites ENABLE ROW LEVEL SECURITY/.test(proposal) && /gh_conversation_invites_no_client/.test(proposal) && /REVOKE ALL ON TABLE public\.gh_conversation_invites FROM PUBLIC, anon, authenticated/.test(proposal))
test('group acceptance is bound to the invited user, rechecks blocks and retries idempotently', /v_inv\.invited_user_id <> p_actor_id/.test(proposal) && /ghc_user_blocks/.test(proposal) && /status = 'accepted'/.test(proposal) && /v_inv\.status = 'accepted' AND p_accept IS TRUE/.test(proposal) && /GROUP_UNAVAILABLE/.test(proposal))
test('group invite inbox is session-scoped and private no-store', /invited_user_id: `eq\.\$\{auth\.userId\}`/.test(groupInvites) && /auth\.source !== \"gh_session\"/.test(groupInvites) && /no-store, private/.test(groupInvites))
test('group invite response validates ID and derives actor from session', /ginv_/.test(groupInviteResponse) && /p_actor_id: auth\.userId/.test(groupInviteResponse) && /auth\.source !== \"gh_session\"/.test(groupInviteResponse))
test('group invitations have accept and decline UI actions', /respond\(invite, true\)/.test(invitePanel) && /respond\(invite, false\)/.test(invitePanel))
test('messenger inbox mounts pending group invitation panel', /<GroupInvitesPanel \/>/.test(messageScreen))

test('contact sharing derives actor from session and exposes no target user field', /p_actor_id: auth\.userId/.test(contactShare) && /auth\.source !== \"gh_session\"/.test(contactShare) && !/targetUserId|contactUserId|sharedUserId/.test(contactShare))
test('contact-share UI preserves its idempotency key for safe retries', /contactShareRequest\?\.conversationId === selected\.id/.test(messageScreen) && /setContactShareRequest\(null\)/.test(messageScreen))
test('contact share RPC only shares actor public profile after membership/privacy/block checks', /m\.gh_user_id = p_actor_id/.test(proposal) && /p\.gh_user_id = p_actor_id/.test(proposal) && /v_visibility <> 'everyone'/.test(proposal) && /BLOCKED_PARTICIPANT/.test(proposal) && /shared_type, shared_id/.test(proposal))
test('contact share is idempotent and writes canonical message record', /client_message_id/.test(proposal) && /IDEMPOTENCY_CONFLICT/.test(proposal) && /gh_messages/.test(proposal))
test('contact share UI clearly limits disclosure to own public profile', /Share my profile/.test(messageScreen) && /only your public GreenHaven profile/.test(messageScreen))
test('shared profile identity survives durable message hydration', /sharedType: typeof raw\.sharedType/.test(context) && /sharedId: typeof raw\.sharedId/.test(context))
test('shared profile message opens public profile from the message card', /message\.sharedType === "profile"/.test(messageComponents) && /ghc:open-profile/.test(messageComponents))

test('community directory endpoint is authenticated, rate-limited, bounded and no-store', /resolveAuthenticatedUser/.test(directory) && /auth\.source !== \"gh_session\"/.test(directory) && /onUnavailable: "deny"/.test(directory) && /p_limit: limit/.test(directory) && /no-store, private/.test(directory))
test('community directory RPC enforces public/private membership boundary', /v_privacy <> 'public' AND v_role IS NULL/.test(proposal) && /gh_community_platform_role/.test(proposal))
test('community directory selects only public profile identity fields', /p\.display_name, p\.username, p\.photos/.test(proposal) && !/p\.bio|p\.city|p\.country|p\.profession|p\.age|p\.gender/.test(proposal))
test('community hub loads canonical member directory with no-store pagination', /api\/communities\/\$\{encodeURIComponent\(community\.id\)\}\/members\?limit=50&offset=/.test(hub) && /cache: "no-store"/.test(hub) && /Load more members/.test(hub))
test('community UI does not invent display names from opaque member IDs', /invent member display names from opaque user IDs/.test(communityScreen) && /memberPreview=\{joined/.test(communityScreen) && !hub.includes('m.charAt(0).toUpperCase()'))
test('all three user-selected tracks are documented with their release gates', /Identity & Authentication/.test(phase4Doc) && /Community discussion and participation/.test(phase4Doc) && /Messenger community communications/.test(phase4Doc) && /not applied/.test(phase4Doc))
test('Phase 4 source, identity integration and auth gates run in pretypecheck/prebuild/static', ['pretypecheck','prebuild:checks','verify:static'].every((key) => ['check-phase4-identity-authentication.mjs','check-phase4-identity-integration.mjs','check-phase4-identity-community-messaging.mjs'].every((script) => (packageScripts[key].match(new RegExp(script, 'g')) || []).length === 1)))
test('all new SQL objects remain in proposal area, not migrations', !fs.readdirSync('supabase/migrations').some((name) => /20261118_phase4_identity_group_contact/i.test(name)) && fs.existsSync('supabase/proposals/20261118_phase4_identity_group_contact.sql'))

const failed = checks.filter((ok) => !ok).length
console.log(`\nPhase 4 coordinated identity/community/messaging: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
