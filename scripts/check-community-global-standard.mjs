#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
const read=(p)=>readFileSync(p,'utf8')
const hub=read('components/ghc/premium-community-hub.tsx')
const join=read('app/api/communities/[id]/join/route.ts')
const requests=read('app/api/communities/[id]/requests/route.ts')
const roles=read('app/api/communities/[id]/roles/route.ts')
const storyReactions=read('app/api/social/stories/[id]/reactions/route.ts')
const ensure=read('app/api/messaging/conversations/[conversationId]/ensure-member/route.ts')
const api=read('app/api/communities/[id]/chat/route.ts')
const migration=read('supabase/migrations/20261031010001_gh_community_chat_governance.sql')
const checks=[
 ['owner-only chat creation is durable',/OWNER_ONLY/.test(migration)&&/gh_community_chat_create/.test(migration)],
 ['community membership paths do not silently enroll chat',! /ensureCommunityMember/.test(join) && ! /ensureCommunityMember/.test(requests)],
 ['chat join requires active community membership',/COMMUNITY_MEMBERSHIP_REQUIRED/.test(migration)],
 ['chat supports member-open and owner-approval privacy',/members','approval/.test(migration)&&/chat_privacy/.test(migration)],
 ['chat membership is explicit opt-in',/Join community chat/.test(hub)&&/Request to join chat/.test(hub)],
 ['owner can create chat with entry policy',/Create · Members join/.test(hub)&&/Create · Approval/.test(hub)],
 ['messaging ensure-member cannot create community chat',!/ensureCommunityConversation/.test(ensure)&&/gh_community_chat_join/.test(ensure)],
 ['community governance APIs use bounded JSON',/readBoundedJson/.test(api) && /readBoundedJson/.test(requests) && /readBoundedJson/.test(roles)],
 ['story reactions use bounded JSON',/readBoundedJson/.test(storyReactions)],
 ['board and realtime chat have separate homes',/Realtime chat stays in Messages/.test(hub)],
 ['governance migration denies direct client access',/REVOKE ALL ON TABLE public\.gh_community_chat_requests/.test(migration)],
]
let fail=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(!ok)fail++}
console.log(`\nCommunity global-standard contract: ${checks.length-fail}/${checks.length} passed`); process.exit(fail?1:0)
