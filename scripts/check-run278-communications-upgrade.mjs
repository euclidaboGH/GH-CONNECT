#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const ctrl = read('lib/calls/direct-call-controller.ts')
const callConfig = read('app/api/messaging/calls/config/route.ts')
const callStart = read('app/api/messaging/calls/route.ts')
const callTransition = read('app/api/messaging/calls/[callId]/transition/route.ts')
const callSignals = read('app/api/messaging/calls/[callId]/signals/route.ts')
const callSheet = read('components/ghc/direct-call-sheet.tsx')
const vercel = JSON.parse(read('vercel.json'))
const discovery = read('app/api/social/people/discover/route.ts')
const follows = read('app/api/social/follows/route.ts')
const matches = read('app/api/matching/signal/route.ts')
const inbox = read('app/api/matching/inbox/route.ts')
const connections = read('app/api/connections/request/route.ts')
const messages = read('components/ghc/message-screen.tsx')
const input = read('components/ghc/message-components.tsx')
const store = read('lib/server/messaging/message-store.ts')
const checks = []
const check = (label, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`) }

// Direct call transport and server authority (1–12).
check('01 call IDs satisfy the database call_[32 hex] contract', /call_\$\{Array\.from\(bytes/.test(ctrl) && /call_\[a-f0-9\]\{32\}/.test(callStart))
check('02 outgoing calls request authenticated server-issued ICE configuration', /\/api\/messaging\/calls\/config/.test(ctrl) && /resolveAuthenticatedUser/.test(callConfig))
check('03 TURN credentials are short-lived HMAC credentials, not client secrets', /createHmac\("sha1"/.test(callConfig) && /GH_CALL_TURN_SHARED_SECRET/.test(callConfig))
check('04 calls remain fail-closed until TURN and operator flag are configured', /GH_CALLS_ENABLED === "true"/.test(callConfig) && /turnUrls\.length > 0/.test(callConfig))
check('05 call creation derives actor from authenticated session and calls canonical RPC', /resolveAuthenticatedUser/.test(callStart) && /gh_call_start/.test(callStart) && /p_actor_id: auth\.userId/.test(callStart))
check('06 incoming calls are polled from canonical durable call state', /gh_call_incoming_for_user/.test(callStart) && /watchIncoming\(\)/.test(ctrl))
check('07 incoming calls expose explicit accept and decline actions', /acceptIncoming/.test(callSheet) && /rejectIncoming/.test(callSheet))
check('08 call transitions are server-authorized and enumerated', /gh_call_transition/.test(callTransition) && /accept.*decline.*cancel.*end/.test(callTransition))
check('09 offer, answer and ICE signals are server-authorized and bounded', /gh_call_signal_append/.test(callSignals) && /20 \* 1024/.test(callSignals) && /offer.*answer.*ice_candidate/.test(callSignals))
check('10 WebRTC peer connection handles offers, answers, ICE and remote tracks', /new RTCPeerConnection/.test(ctrl) && /createOffer/.test(ctrl) && /createAnswer/.test(ctrl) && /addIceCandidate/.test(ctrl) && /ontrack/.test(ctrl))
check('11 peer connectivity is not declared until RTCPeerConnection is connected', /pc\.connectionState === "connected"/.test(ctrl) && /signalingReady: true/.test(ctrl))
check('12 media tracks and peer connections are stopped on teardown', /peerConnection\.close\(\)/.test(ctrl) && /track\.stop\(\)/.test(ctrl))

// Messaging and calling UX (13–22).
check('13 voice and video actions remain available from direct message header', /onCall=/.test(messages) && /onVideo=/.test(messages))
check('14 incoming calls render caller identity and actionable buttons', /Incoming call/.test(callSheet) && /Accept/.test(callSheet) && /Decline/.test(callSheet))
check('15 remote video and local camera preview are rendered separately', /remoteVideo/.test(callSheet) && /localVideo/.test(callSheet))
check('16 remote audio is attached to an autoplay audio element', /remoteAudio/.test(callSheet) && /autoPlay/.test(callSheet))
check('17 microphone and camera can be toggled without ending the call', /toggleAudio/.test(ctrl) && /toggleVideo/.test(ctrl) && /Mute microphone/.test(callSheet))
check('18 call state has bounded ring and connection timeouts', /CALL_RING_TIMEOUT_MS/.test(ctrl) && /CALL_CONNECT_TIMEOUT_MS/.test(ctrl))
check('19 call attempts no longer fire the non-signaling intent-only endpoint', !/\/api\/messaging\/calls\/intent/.test(read('lib/messaging/call-bridge.ts')))
check('20 message composer retains voice-note capture and attachment actions', /recordVoiceNote/.test(messages) && /onVoiceNote/.test(input) && /onAttachmentClick/.test(input))
check('21 message search remains server-side and scoped to active conversation', /\/search\?q=/.test(messages) && /encodeURIComponent\(selectedId\)/.test(messages))
check('22 durable messaging keeps idempotency and owned-media validation', /client_message_id/.test(store) && /validateOwnedMediaAttachments/.test(read('app/api/messaging/conversations/[conversationId]/messages/route.ts')))

// Discovery, match, connect and follow integrity (23–30).
check('23 discovery uses privacy-aware canonical candidate RPC', /gh_discovery_candidates/.test(discovery) && /socialRpc\("gh_discovery_candidates"/.test(discovery))
check('24 discovery trusts RPC matches-only eligibility and suppresses hidden/location/interests/bio privacy fields', /gh_discovery_candidates/.test(discovery) && /visibility === \"hidden\"/.test(discovery) && /locationVisible/.test(discovery) && /interestsVisible/.test(discovery) && /bioVisible/.test(discovery) && !/visibility === \"hidden\" \|\| visibility === \"matches-only\"/.test(discovery))
check('25 discovery supports bounded search and stable keyset cursor', /beforeUpdatedAt/.test(discovery) && /beforeUserId/.test(discovery) && /p_query/.test(discovery) && /nextCursor/.test(discovery))
check('26 discovery read throttling is durable and fail-closed', /checkDurableRateLimit/.test(discovery) && /onUnavailable: "deny"/.test(discovery))
check('27 follow writes use durable fail-closed throttling and session actor', /checkDurableRateLimit/.test(follows) && /onUnavailable: "deny"/.test(follows) && /p_follower_id: auth\.userId/.test(follows))
check('28 match writes use durable fail-closed throttling and session actor', /checkDurableRateLimit/.test(matches) && /onUnavailable: "deny"/.test(matches) && /p_from_user_id: auth\.userId/.test(matches))
check('29 match inbox reads and connection request writes are durably throttled', /checkDurableRateLimit/.test(inbox) && /failClosed: true/.test(connections))
check('30 call and social APIs retain no-store responses and bounded JSON input', /Cache-Control.*no-store/.test(callStart) && /readBoundedJson/.test(callStart) && /readBoundedJson/.test(callSignals))
check('31 repository Vercel build command clears stale Webpack cache before Next build', /prepare-vercel-build\.mjs/.test(vercel.buildCommand))

const passed = checks.filter(Boolean).length
console.log(`\nRun 278 communications upgrade: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
