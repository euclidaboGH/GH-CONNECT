import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (label, condition) => {
  checks.push({ label, pass: Boolean(condition) })
  console.log(`  ${condition ? '✓' : '✗'} ${label}`)
}

console.log('\n=== VERCEL BUILD REPAIR REGRESSION ===\n')
const context = read('contexts/ghc-context.tsx')
const addToastDeclaration = context.indexOf('const addToast = useCallback(')
const messagingPreferencesEffect = context.indexOf('// Hydrate server-authoritative messaging and online-status privacy.')
check('addToast is declared before messaging preferences effect', addToastDeclaration >= 0 && messagingPreferencesEffect >= 0 && addToastDeclaration < messagingPreferencesEffect)
check('messaging preferences effect declares addToast dependency', /\[state\.ready, identityUserId, state\.settings\.whoCanMessage, state\.settings\.onlineStatus, addToast\]/.test(context))
const sendMessageStart = context.indexOf('const sendMessage = useCallback(async (conversationId: string, text: string, replyToMessageId?: string, sharedPostId?: string): Promise<boolean> => {')
const sendMessageEnd = context.indexOf('return !permanentFailure', sendMessageStart)
const sendMessageBody = context.slice(sendMessageStart, sendMessageEnd)
const permanentFailureDeclaration = sendMessageBody.indexOf('let permanentFailure = false')
const innerRemoteTry = sendMessageBody.indexOf('const { apiSendMessageWithRetry }')
check('sendMessage outcome flag is function-scoped and declared before remote send', sendMessageStart >= 0 && sendMessageEnd > sendMessageStart && permanentFailureDeclaration >= 0 && permanentFailureDeclaration < innerRemoteTry && (sendMessageBody.match(/let permanentFailure = false/g) || []).length === 1)

const rewards = read('components/ghc/daily-reward-experience.tsx')
const rewardCallbacks = [...rewards.matchAll(/\}, \[([^\]]*refreshServerStatus[^\]]*)\]\)/g)].map((match) => match[1])
check('daily reward callbacks include streakDays dependency', rewardCallbacks.length >= 2 && rewardCallbacks.every((deps) => /daily\.streakDays/.test(deps)))

const messages = read('components/ghc/message-screen.tsx')
check('message read effect uses selected identity in guard', /if \(!selectedId \|\| selected\?\.id !== selectedId \|\| markedRef\.current === selectedId\) return/.test(messages))

const compose = read('components/ghc/unified-compose.tsx')
check('compose mode effect includes initialMode dependency', /\}, \[open, initialMode, onOpenChange, uploadProgress, isPublishing\]\)/.test(compose))

const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
check('package and lockfile versions match', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version)
check('build keeps lint and type validation enabled', !/ignoreBuildErrors\s*:\s*true/.test(read('next.config.mjs')) && !/ignoreDuringBuilds\s*:\s*true/.test(read('next.config.mjs')))

const failed = checks.filter((item) => !item.pass)
console.log(`\n=== RESULTS: ${checks.length - failed.length} passed, ${failed.length} failed ===`)
if (failed.length) process.exitCode = 1
