/**
 * Two-account media DM probe (operator-run).
 *
 * Env (never paste cookies into chat):
 *   GHC_E2E_BASE_URL
 *   GHC_E2E_COOKIE_A
 *   GHC_E2E_COOKIE_B
 *   GHC_E2E_CONVERSATION_ID  (optional; creates via API if omitted + otherUserId)
 *   GHC_E2E_PEER_USER_ID_B   (user B id for A to open DM)
 *   GHC_E2E_MEDIA_URL        (https URL already in storage — required)
 *
 * Does NOT upload files (avoids binary in CI). Proves attachment persistence + cross-read.
 */
const base = String(process.env.GHC_E2E_BASE_URL || "").replace(/\/$/, "")
const cookieA = process.env.GHC_E2E_COOKIE_A || ""
const cookieB = process.env.GHC_E2E_COOKIE_B || ""
const mediaUrl = process.env.GHC_E2E_MEDIA_URL || ""
const peerB = process.env.GHC_E2E_PEER_USER_ID_B || ""
let conversationId = process.env.GHC_E2E_CONVERSATION_ID || ""

function fail(msg) {
  console.error("FAIL:", msg)
  process.exit(1)
}
if (!base) fail("GHC_E2E_BASE_URL required")
if (!cookieA || !cookieB) fail("GHC_E2E_COOKIE_A and GHC_E2E_COOKIE_B required")
if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl) || mediaUrl.startsWith("blob:")) {
  fail("GHC_E2E_MEDIA_URL must be a durable http(s) URL")
}

async function req(cookie, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const health = await req(cookieA, "/api/media/health")
console.log("media.health", health.status, health.body?.authenticated, health.body?.bucketReachable)

if (!conversationId) {
  if (!peerB) fail("Need GHC_E2E_CONVERSATION_ID or GHC_E2E_PEER_USER_ID_B")
  const created = await req(cookieA, "/api/messaging/conversations", {
    method: "POST",
    body: JSON.stringify({ otherUserId: peerB }),
  })
  conversationId = created.body?.conversation?.id || created.body?.id || ""
  if (!conversationId) fail(`Could not open conversation: ${JSON.stringify(created.body)}`)
  console.log("conversation", conversationId)
}

const clientMessageId = `e2e_media_${Date.now().toString(36)}`
const send = await req(cookieA, `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages`, {
  method: "POST",
  body: JSON.stringify({
    body: "📷 Photo",
    clientMessageId,
    mediaAttachments: [{ id: "e2e_att_1", type: "image", url: mediaUrl, fileName: "e2e.jpg" }],
  }),
})
console.log("send", send.status, send.body?.ok, send.body?.durable, send.body?.error)
if (!send.body?.ok) fail("A could not send media message")

const listB = await req(cookieB, `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages?limit=40`)
const messages = Array.isArray(listB.body?.messages) ? listB.body.messages : []
const found = messages.find((m) => m.clientMessageId === clientMessageId || m.id === send.body?.message?.id)
const atts = found?.mediaAttachments || found?.meta?.attachments || []
const urlOk = Array.isArray(atts) && atts.some((a) => String(a.url || "") === mediaUrl)
console.log("B.list", listB.status, "found", Boolean(found), "urlOk", urlOk, "count", messages.length)
if (!found || !urlOk) fail("B does not see durable media attachment from A")
console.log("PASS: cross-account durable media DM")
