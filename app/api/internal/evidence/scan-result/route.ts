import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
export async function POST(request: Request) {
  const secret = String(process.env.GHC_EVIDENCE_SCANNER_SECRET || "")
  if (secret.length < 32) return NextResponse.json({ ok: false, error: "SCANNER_NOT_CONFIGURED" }, { status: 503, headers: noStore })
  const reader = request.body?.getReader()
  if (!reader) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 8 * 1024) { await reader.cancel(); return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: noStore }) }
      chunks.push(part.value)
    }
  } finally { reader.releaseLock() }
  const rawBody = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8")
  let body: Record<string, unknown>
  try { const parsed = JSON.parse(rawBody); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid"); body = parsed as Record<string, unknown> }
  catch { return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: noStore }) }
  const rawSignature = String(request.headers.get("x-gh-evidence-signature") || "").replace(/^sha256=/i, "")
  const expected = createHmac("sha256", secret).update(rawBody).digest()
  let supplied: Buffer
  try { supplied = Buffer.from(rawSignature, "hex") } catch { supplied = Buffer.alloc(0) }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ ok: false, error: "INVALID_SCANNER_SIGNATURE" }, { status: 401, headers: noStore })
  const evidenceType = String(body.evidenceType || "")
  const evidenceId = String(body.evidenceId || "")
  const sha256 = String(body.sha256 || "").toLowerCase()
  const verdict = String(body.verdict || "")
  const engine = String(body.engine || "").slice(0, 80)
  if (!(["research","field_report"].includes(evidenceType)) || !/^[0-9a-f-]{36}$/i.test(evidenceId) || !/^[a-f0-9]{64}$/.test(sha256) || !["clean","infected","error"].includes(verdict) || !engine) return NextResponse.json({ ok: false, error: "INVALID_SCAN_RESULT" }, { status: 400, headers: noStore })
  const table = evidenceType === "research" ? "gh_research_evidence" : "gh_field_report_evidence"
  const current = await supabaseRest<Array<{ id: string; sha256: string | null; scan_status: string; verification_status: string }>>(`${table}?id=eq.${evidenceId}&select=id,sha256,scan_status,verification_status&limit=1`)
  if (!current.ok || !current.data.length || (current.data[0].sha256 && current.data[0].sha256 !== sha256)) return NextResponse.json({ ok: false, error: "EVIDENCE_HASH_MISMATCH" }, { status: 409, headers: noStore })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`${table}?id=eq.${evidenceId}&scan_status=in.(pending,error)&select=id,scan_status,verification_status`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ scan_status: verdict, verification_status: verdict === "clean" ? (current.data[0].verification_status === "quarantined" ? "pending" : current.data[0].verification_status) : "quarantined", scanner_engine: engine, scanned_at: new Date().toISOString() }) })
  if (!updated.ok || !updated.data.length) return NextResponse.json({ ok: false, error: "SCAN_RESULT_SAVE_FAILED" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, evidence: updated.data[0] }, { headers: noStore })
}
