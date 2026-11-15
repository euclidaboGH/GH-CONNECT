#!/usr/bin/env node
/** Run 274: deeper DM / discovery / matches / calls wiring. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(fileURLToPath(new URL('..', import.meta.url)))
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n) } else { fail++; console.error('FAIL', n) } }
const pkg = JSON.parse(r('package.json'))
const msg = r('components/ghc/message-screen.tsx')
const input = r('components/ghc/message-components.tsx')
const voice = r('lib/messaging/voice-note-recorder.ts')
const bridge = r('lib/messaging/call-bridge.ts')
const match = r('components/ghc/match-screen.tsx')
const follow = r('lib/social/follow-connect-actions.ts')
const ctrl = r('lib/calls/direct-call-controller.ts')

ok('01 current package retains Run 274 DM/discovery foundation', pkg.version.localeCompare('0.338.40', undefined, { numeric: true }) >= 0)
ok('02 thread hides bottom nav', /ghc:bottom-nav-visibility/.test(msg) && /hidden: Boolean\(selectedId\)/.test(msg))
ok('03 bottom nav restored on unmount', /hidden: false/.test(msg))
ok('04 voice note recorder helper', /recordVoiceNote/.test(voice) && /MediaRecorder/.test(voice))
ok('05 voice note max 60s', /60_000/.test(voice))
ok('06 MessageInput onVoiceNote prop', /onVoiceNote\?:/.test(input))
ok('07 MessageInput mic button', /Record voice note/.test(input) || /aria-label="Record voice note"/.test(input))
ok('08 message-screen wires onVoiceNote', /onVoiceNote=/.test(msg) && /recordVoiceNote/.test(msg))
ok('09 call bridge delegates to durable WebRTC controller', /startOutgoing/.test(bridge) && !/\/api\/messaging\/calls\/intent/.test(bridge))
ok('10 follow-connect humanize helpers', /humanizeFollowError/.test(follow) && /humanizeConnectError/.test(follow))
ok('11 social graph changed event', /ghc:social-graph-changed/.test(follow))
ok('12 matches visibility refresh', /visibilitychange/.test(match) && /ghc:matches-refresh/.test(match))
ok('13 direct call controller retained', /class DirectCallController/.test(ctrl))
ok('14 ChatHeader onCall retained', /onCall=/.test(msg))
ok('15 ChatHeader onVideo retained', /onVideo=/.test(msg))
ok('16 voice support detector', /isVoiceNoteSupported/.test(voice))
ok('17 MessageInput Mic import present', /Mic/.test(input))
ok('18 call history still used', /pushCallHistory/.test(bridge))
ok('19 attach still max 4 files', /slice\(0, 4\)/.test(msg))
ok('20 message body counter 8000', /8000/.test(input))

console.log(`\nRun 274 DM/discovery deep: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
