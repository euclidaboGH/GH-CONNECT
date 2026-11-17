import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { supabaseRest } from "@/lib/server/supabase/rest-client"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const secret = String(process.env.GHC_EVIDENCE_SCANNER_SECRET || "")
  const authorization = request.headers.get("authorization") || ""
  const supplied = authorization.startsWith("Bearer ") ? Buffer.from(authorization.slice(7)) : Buffer.alloc(0)
  const expected = Buffer.from(secret)
  if (secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  type ResearchEvidenceRow = { id: string; storage_bucket: string; object_path: string; sha256: string | null; mime_type: string; byte_size: number }
  type FieldEvidenceRow = { id: string; media_asset_id: string; sha256: string | null }
  const [research, field] = await Promise.all([
    supabaseRest<ResearchEvidenceRow[]>("gh_research_evidence?scan_status=in.(pending,error)&select=id,storage_bucket,object_path,sha256,mime_type,byte_size&order=created_at.asc&limit=20"),
    supabaseRest<FieldEvidenceRow[]>("gh_field_report_evidence?scan_status=in.(pending,error)&select=id,media_asset_id,sha256&order=created_at.asc&limit=20"),
  ])
  if (!research.ok || !field.ok) return NextResponse.json({ ok: false, error: "SCAN_QUEUE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "STORAGE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const base = env.supabaseUrl.replace(/\/$/, "")
  const all: Array<(ResearchEvidenceRow & { evidence_type: "research" }) | (FieldEvidenceRow & { evidence_type: "field_report" })> = [...research.data.map(row=>({...row,evidence_type:"research" as const})),...field.data.map(row=>({...row,evidence_type:"field_report" as const}))].slice(0,30)
  const items = await Promise.all(all.map(async row=>{
    let bucket = row.evidence_type === "research" ? row.storage_bucket : ""
    let path = row.evidence_type === "research" ? row.object_path : ""
    let mimeType = row.evidence_type === "research" ? row.mime_type : ""
    let byteSize = row.evidence_type === "research" ? Number(row.byte_size || 0) : 0
    if (row.evidence_type === "field_report") {
      const asset = await supabaseRest<Array<{bucket:string;storage_path:string;mime_type:string;byte_size:number}>>(`gh_media_assets?id=eq.${encodeURIComponent(String(row.evidence_type === "field_report" ? row.media_asset_id : ""))}&select=bucket,storage_path,mime_type,byte_size&limit=1`)
      if (!asset.ok || !asset.data.length) return null
      bucket = asset.data[0].bucket; path = asset.data[0].storage_path; mimeType = asset.data[0].mime_type; byteSize = Number(asset.data[0].byte_size)
    }
    if (!bucket || !path || path.startsWith("/") || path.split("/").some(part=>!part||part==="."||part==="..")) return null
    const signed = await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:{apikey:env.supabaseServiceRoleKey!,Authorization:`Bearer ${env.supabaseServiceRoleKey}`,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:120}),cache:"no-store",signal:AbortSignal.timeout(8000)})
    const payload = await signed.json().catch(()=>null) as {signedURL?:string;signedUrl?:string}|null
    const candidate=payload?.signedURL||payload?.signedUrl
    if(!signed.ok||!candidate)return null
    const target=candidate.startsWith("https://")?new URL(candidate):new URL(candidate.startsWith("/storage/v1/")?candidate:`/storage/v1${candidate}`,base)
    if(target.protocol!=="https:"||target.origin!==new URL(base).origin||!target.pathname.includes("/object/sign/"))return null
    return {evidenceType:row.evidence_type,evidenceId:row.id,sha256:row.sha256||null,mimeType:mimeType||null,byteSize:byteSize||null,downloadUrl:target.toString()}
  }))
  return NextResponse.json({ok:true,items:items.filter(Boolean)}, {headers:{"Cache-Control":"no-store","Pragma":"no-cache"}})
}
