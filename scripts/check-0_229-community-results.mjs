import fs from 'node:fs'
const screen=fs.readFileSync('components/ghc/communities-screen.tsx','utf8')
const hub=fs.readFileSync('components/ghc/premium-community-hub.tsx','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const checks=[
 ['version 0.229.0',pkg.version==='0.229.0'],
 ['community pulse action center',screen.includes('Your community pulse')],
 ['board update aggregate',screen.includes('boardUnread')],
 ['chat unread aggregate',screen.includes('chatUnread')],
 ['governance requests aggregate',screen.includes('requestsToReview')],
 ['needs-attention sort',screen.includes('value="unread"') && screen.includes('Needs attention')],
 ['attention-first sorting logic',screen.includes('sortBy === "unread"')],
 ['community continue action',hub.includes('Continue where attention is needed')],
 ['board/chat boundary retained',hub.includes('Board ≠ Chat')],
]
let fail=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) fail++}
console.log(`\n0.229 community results: ${checks.length-fail}/${checks.length} passed`)
if(fail) process.exit(1)
