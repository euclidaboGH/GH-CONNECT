#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
const root=process.cwd()
const registry=JSON.parse(readFileSync(join(root,'lib/architecture/domain-mutation-route-owners.json'),'utf8'))
const domains=new Set(['identity','walletGhc','walletPiEarnings','marketplace','membership','messaging','feed','media','rewards','communities','notifications','trustSafety','payments'])
const rules=[...registry.rules].sort((a,b)=>b.prefix.length-a.prefix.length)
function walk(dir){let out=[];for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())out.push(...walk(p));else if(name==='route.ts')out.push(p)}return out}
const mutating=[];const failures=[]
for(const file of walk(join(root,'app/api'))){
 const source=readFileSync(file,'utf8')
 const methods=[...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(m=>m[1])
 const writes=methods.filter(m=>m!=='GET')
 if(!writes.length)continue
 const route='/'+relative(join(root,'app'),file).replaceAll('\\','/')
 const matches=rules.filter(rule=>route===rule.prefix||route.startsWith(rule.prefix+'/'))
 if(matches.length===0){failures.push(`${route}: no owner`);continue}
 const longest=matches[0].prefix.length
 const owners=[...new Set(matches.filter(x=>x.prefix.length===longest).map(x=>x.owner))]
 if(owners.length!==1||!domains.has(owners[0])){failures.push(`${route}: ambiguous/invalid owner ${owners.join(',')}`);continue}
 mutating.push({route,methods:[...new Set(writes)].join(','),owner:owners[0]})
}
const counts=Object.fromEntries([...domains].map(d=>[d,mutating.filter(x=>x.owner===d).length]).filter(([,n])=>n))
console.log(`Mutating API routes assigned: ${mutating.length}`)
console.log(`Domain owner distribution: ${JSON.stringify(counts)}`)
for(const failure of failures)console.error(`FAIL ${failure}`)
if(failures.length){console.error(`Domain mutation route ownership: ${mutating.length} assigned; ${failures.length} unassigned/ambiguous`);process.exit(1)}
console.log('PASS every mutating API route has exactly one declared domain owner')
console.log('NOTE this is route-level accountability; DB/RPC duplicate-writer elimination still requires a write-path and deployed catalog audit.')
