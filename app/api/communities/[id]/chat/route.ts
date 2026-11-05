import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }
const noStore = { "Cache-Control": "no-store" }

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok:false,error:"AUTH_REQUIRED" },{status:401,headers:noStore})
  if (!socialDbConfigured()) return NextResponse.json({ok:false,error:"STORE_UNAVAILABLE"},{status:503,headers:noStore})
  const { id } = await ctx.params
  const result = await socialRpc("gh_community_chat_state", { p_community_id:String(id||"").trim(), p_user_id:auth.userId })
  if (!result.ok) return NextResponse.json({ok:false,error:result.error||"CHAT_STATE_FAILED"},{status:503,headers:noStore})
  return NextResponse.json(result.data,{headers:noStore})
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401,headers:noStore})
  const rl=checkRateLimit(`community-chat:${auth.userId}`,20,60_000)
  if(!rl.ok) return NextResponse.json({ok:false,error:"RATE_LIMITED"},{status:429,headers:{...noStore,"Retry-After":String(rl.retryAfterSec)}})
  if (!socialDbConfigured()) return NextResponse.json({ok:false,error:"STORE_UNAVAILABLE"},{status:503,headers:noStore})
  const parsed=await readBoundedJson(request,8*1024)
  if(!parsed.ok) return NextResponse.json({ok:false,error:parsed.error},{status:parsed.error==="REQUEST_TOO_LARGE"?413:400,headers:noStore})
  const body=parsed.value
  const action=typeof body.action==="string"?body.action:"join"
  const { id }=await ctx.params
  const communityId=String(id||"").trim()
  let result
  if(action==="create") {
    const privacy=body.privacy==="approval"?"approval":"members"
    result=await socialRpc("gh_community_chat_create",{p_community_id:communityId,p_owner_id:auth.userId,p_chat_privacy:privacy})
  } else if(action==="review") {
    const userId=typeof body.userId==="string"?body.userId.trim():""
    if(!userId) return NextResponse.json({ok:false,error:"INVALID_USER"},{status:400,headers:noStore})
    result=await socialRpc("gh_community_chat_review",{p_community_id:communityId,p_owner_id:auth.userId,p_user_id:userId,p_approve:body.approve===true})
  } else {
    result=await socialRpc("gh_community_chat_join",{p_community_id:communityId,p_user_id:auth.userId})
  }
  const data=result.data as {ok?:boolean;error?:string}|null
  if(!result.ok||data?.ok===false){const e=data?.error||result.error||"CHAT_ACTION_FAILED";return NextResponse.json({ok:false,error:e},{status:e==="OWNER_ONLY"||e==="COMMUNITY_MEMBERSHIP_REQUIRED"?403:e==="NOT_FOUND"?404:409,headers:noStore})}
  return NextResponse.json(data,{headers:noStore})
}
