import fs from 'node:fs'
import path from 'node:path'

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const checks = []
const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

const profile = read('components/ghc/profile-screen.tsx')
const profileCards = read('components/ghc/profile-components.tsx')
check(
  'profile edit callback supports the media argument passed by the card',
  /onEdit=\{\(postId, content, media\?\) => \{ void handleTimelineEdit\(postId, content, media\) \}\}/.test(profile) &&
    /onEdit\?: \(postId: string, content: string, media\?: PostEditMedia\) => void/.test(profileCards) &&
    /socialEditPost\(postId, content, media\)/.test(profile),
)

const editRoute = read('app/api/social/posts/[id]/edit/route.ts')
check(
  'post edit image validation has an explicit nullable string callback type',
  /images\.some\(\(x: string \| null\) => !x\)/.test(editRoute),
)

const economy = read('lib/domains/economy-domain.ts')
check(
  'server reward claim snapshots the wallet without self-referential declaration',
  /const walletSnapshot = wallet\(\)/.test(economy) &&
    /data: \{ reward: \{ \.\.\.reward, validationStatus: "paid" \}, wallet: walletSnapshot \}/.test(economy) &&
    !/const\s+wallet\s*=\s*wallet\(\)/.test(economy),
)

const connectionCard = read('components/ghc/connection-card.tsx')
check(
  'connection card imports the formatter used in its JSX',
  /import\s*\{[^}]*formatIntentChip[^}]*\}\s*from\s*["']@\/lib\/discovery\/match-clarity["']/.test(connectionCard) &&
    connectionCard.includes('formatIntentChip(String(selectedIntent))'),
)

const postCard = read('components/ghc/enhanced-post-card.tsx')
check(
  'post image URL startsWith is protected by a string type guard',
  /typeof u !== "string" \|\| !u\.trim\(\)/.test(postCard) && /u\.startsWith\("data:image\/"\)/.test(postCard),
)

const story = read('components/ghc/profile-story-section.tsx')
check(
  'story data-image prefix check accepts a string-typed URL only',
  /function isInlineImage\(url: string \| undefined\)/.test(story) && /url\.startsWith\("data:image\/"\)/.test(story),
)

const pkg = JSON.parse(read('package.json'))
check(
  'CI payment durability test command is registered and points to an existing test',
  pkg.scripts['test:pi-payment-durable'] === 'node scripts/test-pi-payment-durable.mjs' &&
    fs.existsSync(path.join(process.cwd(), 'scripts/test-pi-payment-durable.mjs')),
)

const failed = checks.filter((item) => !item.pass)
console.log(`\nREPORTED BUILD REGRESSIONS: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
