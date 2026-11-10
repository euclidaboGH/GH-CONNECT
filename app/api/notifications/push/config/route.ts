import { NextResponse } from "next/server"
import { getWebPushConfiguration } from "@/lib/server/notifications/push-architecture"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const config = getWebPushConfiguration()
  return NextResponse.json({
    ok: true,
    protocol: config.protocol,
    provider: config.provider,
    publicKey: config.publicKey,
    status: config.senderImplemented ? "ready" : "provider_sender_not_integrated",
    remoteDeliveryEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } })
}
