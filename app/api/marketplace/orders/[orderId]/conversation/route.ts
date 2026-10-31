import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { loadOrder } from "@/lib/server/marketplace/order-store"
import { createDirectConversation, setConversationContext, isMessagingStoreDurable } from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ orderId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok:false,error:"AUTH_REQUIRED" }, { status:401, headers:{"Cache-Control":"no-store"} })
  const { orderId } = await ctx.params
  if (!orderId || orderId.length > 180 || /[\u0000-\u001f\u007f]/.test(orderId)) return NextResponse.json({ok:false,error:"INVALID_ORDER_ID"},{status:400})
  const order = await loadOrder(orderId)
  if (!order) return NextResponse.json({ok:false,error:"NOT_FOUND"},{status:404})
  if (auth.userId !== order.buyerId && auth.userId !== order.sellerId) return NextResponse.json({ok:false,error:"FORBIDDEN"},{status:403})
  const peer = auth.userId === order.buyerId ? order.sellerId : order.buyerId
  const conversation = await createDirectConversation({ creatorId: auth.userId, otherUserId: peer })
  if (!conversation) return NextResponse.json({ok:false,error:"CREATE_FAILED"},{status:503})
  if ("denied" in conversation) return NextResponse.json({ok:false,error:conversation.denied},{status:403})
  const context = await setConversationContext({
    conversationId: conversation.id,
    actorId: auth.userId,
    contextType: "marketplace_order",
    contextId: order.id,
    title: `Order · ${order.listingTitle}`,
  })
  if (!context.ok) return NextResponse.json({ok:false,error:context.error},{status:context.error==="FORBIDDEN"?403:503})
  return NextResponse.json({ok:true,durable:isMessagingStoreDurable(),conversation,orderId:order.id,contextType:"marketplace_order",contextId:order.id},{headers:{"Cache-Control":"no-store"}})
}
