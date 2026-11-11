import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"
import { sanitizeCommunityId } from "@/lib/server/community/community-integrity"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }
const noStore = { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" }

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok:false,error:"AUTH_REQUIRED" },{status:401,headers:noStore})
  const { id } = await ctx.params
  const communityId = sanitizeCommunityId(id)
  if (!communityId || !/^[a-zA-Z0-9_-]{1,160}$/.test(communityId)) return NextResponse.json({ok:false,error:"INVALID_ID"},{status:400,headers:noStore})
  if (!socialDbConfigured()) return NextResponse.json({ok:false,error:"STORE_UNAVAILABLE"},{status:503,headers:noStore})
  const result = await socialRpc("gh_community_chat_state", { p_community_id:communityId, p_user_id:auth.userId })
  if (!result.ok) return NextResponse.json({ok:false,error:result.error||"CHAT_STATE_FAILED"},{status:503,headers:noStore})
  return NextResponse.json(result.data,{headers:noStore})
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401,headers:noStore})
  const rateLimited = await enforceUserMutationRateLimit(auth.userId, "communities/[id]/chat:POST", 20, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited
  if (!socialDbConfigured()) return NextResponse.json({ok:false,error:"STORE_UNAVAILABLE"},{status:503,headers:noStore})
  const parsed=await readBoundedJson(request,8*1024)
  if(!parsed.ok) return NextResponse.json({ok:false,error:parsed.error},{status:parsed.error==="REQUEST_TOO_LARGE"?413:400,headers:noStore})
  const body=parsed.value
  if (body.action != null && typeof body.action !== "string") return NextResponse.json({ok:false,error:"INVALID_ACTION"},{status:400,headers:noStore})
  const action=body.action == null ? "join" : body.action.trim()
  const { id }=await ctx.params
  const communityId=sanitizeCommunityId(id)
  if (!communityId || !/^[a-zA-Z0-9_-]{1,160}$/.test(communityId)) return NextResponse.json({ok:false,error:"INVALID_ID"},{status:400,headers:noStore})
  if (!new Set(["create", "review", "join"]).has(action)) return NextResponse.json({ok:false,error:"INVALID_ACTION"},{status:400,headers:noStore})
  let result
  if(action==="create") {
    const privacy=body.privacy==="approval"?"approval":"members"
    result=await socialRpc("gh_community_chat_create",{p_community_id:communityId,p_owner_id:auth.userId,p_chat_privacy:privacy})
  } else if(action==="review") {
    const userId=typeof body.userId==="string"?body.userId.trim():""
    if(!userId || userId.length > 160 || /[\u0000-\u001f\u007f]/.test(userId)) return NextResponse.json({ok:false,error:"INVALID_USER"},{status:400,headers:noStore})
    if (typeof body.approve !== "boolean") return NextResponse.json({ok:false,error:"APPROVAL_DECISION_REQUIRED"},{status:400,headers:noStore})
    result=await socialRpc("gh_community_chat_review",{p_community_id:communityId,p_owner_id:auth.userId,p_user_id:userId,p_approve:body.approve})
  } else {
    result=await socialRpc("gh_community_chat_join",{p_community_id:communityId,p_user_id:auth.userId})
  }
  const data=result.data as {ok?:boolean;error?:string}|null
  if(!result.ok||data?.ok===false){const e=data?.error||result.error||"CHAT_ACTION_FAILED";return NextResponse.json({ok:false,error:e},{status:e==="OWNER_ONLY"||e==="COMMUNITY_MEMBERSHIP_REQUIRED"?403:e==="NOT_FOUND"?404:409,headers:noStore})}
  return NextResponse.json(data,{headers:noStore})
}
