import fs from 'node:fs'
const p='components/ghc/message-screen.tsx'
const s=fs.readFileSync(p,'utf8')
const checks=[
 ['requests filter type',s.includes('"requests" | "communities"')],
 ['request count',s.includes('const requestCount = useMemo')],
 ['request filtering',s.includes('filter === "requests"')],
 ['requests UI',s.includes('No message requests')],
 ['draft persistence key',s.includes('ghc.message-draft.${selectedId}')],
 ['draft restore',s.includes('localStorage.getItem(`ghc.message-draft.${selectedId}`)')],
 ['draft clear after confirmed send',s.includes('localStorage.removeItem(`ghc.message-draft.${selectedId}`)') && s.indexOf('if (accepted === false || accepted === undefined)') < s.indexOf('localStorage.removeItem(`ghc.message-draft.${selectedId}`)')],
 ['community inbox retained',s.includes('filter === "communities"')],
 ['offline recovery retained',s.includes('ghc:messaging-reconcile')],
]
let ok=true
for(const [name,pass] of checks){ console.log(`${pass?'PASS':'FAIL'} ${name}`); if(!pass) ok=false }
if(!ok) process.exit(1)
console.log(`Messaging massive-upgrade gate: ${checks.length}/${checks.length} PASS`)
