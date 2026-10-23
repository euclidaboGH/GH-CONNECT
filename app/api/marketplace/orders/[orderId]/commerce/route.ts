import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder, updateCommerceOrder } from "@/lib/server/marketplace/order-store"
export const runtime="nodejs"; export const dynamic="force-dynamic"
const ACTIONS=new Set(["seller_fulfill","seller_mark_delivered","buyer_confirm","dispute","cancel_unpaid"])
export async function POST(request:Request,ctx:{params:Promise<{orderId:string}>}){
 const auth=await resolveAuthenticatedUser(request.headers); if(!auth)return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401})
 const {orderId}=await ctx.params; const order=await loadOrder(orderId); if(!order)return NextResponse.json({ok:false,error:"NOT_FOUND"},{status:404})
 if(order.buyerId!==auth.userId&&order.sellerId!==auth.userId)return NextResponse.json({ok:false,error:"FORBIDDEN"},{status:403})
 const body=await request.json().catch(()=>({})); const action=String(body.action||"").trim().toLowerCase(); const note=String(body.note||"").trim().slice(0,500)
 if(!ACTIONS.has(action))return NextResponse.json({ok:false,error:"INVALID_ACTION"},{status:400})
 const result=await updateCommerceOrder(orderId,auth.userId,action as Parameters<typeof updateCommerceOrder>[2],note)
 if(!result.ok){const status=["FORBIDDEN","SELLER_ONLY","BUYER_ONLY"].includes(result.error)?403:["PAYMENT_REQUIRED","INVALID_STATE","PAID_OR_STARTED"].includes(result.error)?409:400;return NextResponse.json({ok:false,error:result.error},{status})}
 return NextResponse.json({ok:true,order:result.order},{headers:{"Cache-Control":"no-store"}})
}
