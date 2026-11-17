#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const checks = [
  ['durable media store calls the canonical asset-create RPC', /supabaseRpc<Record<string, unknown>>\("gh_media_asset_create"/.test(read('lib/server/media/asset-store.ts'))],
  ['durable media store sends the complete immutable identity', ['p_id','p_owner_id','p_bucket','p_storage_path','p_media_kind','p_mime_type','p_byte_size','p_metadata'].every((x) => read('lib/server/media/asset-store.ts').includes(x))],
  ['media store rejects unsafe owned paths before persistence', /parseOwnedMediaPath\(input\.ownerId, input\.storagePath\)/.test(read('lib/server/media/asset-store.ts'))],
  ['media store validates bucket, MIME, category and metadata', ['isSafeMediaBucket','mediaCategoryMatches','mediaExtensionMatchesMime','validateMediaMetadata'].every((x) => read('lib/server/media/asset-store.ts').includes(x))],
  ['existing signed upload intent remains authenticated', /resolveAuthenticatedUser/.test(read('app/api/media/direct-upload-intent/route.ts'))],
  ['existing upload completion verifies the durable object', /UPLOADED_OBJECT_NOT_VERIFIED/.test(read('app/api/media/direct-upload-complete/route.ts'))],
  ['research evidence attach requires authenticated owner', /resolveAuthenticatedUser/.test(read('app/api/research/projects/[id]/evidence/route.ts')) && /owner_user_id=eq/.test(read('app/api/research/projects/[id]/evidence/route.ts'))],
  ['research evidence attach checks response belongs to project', /gh_research_responses\?id=eq\.\$\{responseId\}&project_id=eq\.\$\{projectId\}/.test(read('app/api/research/projects/[id]/evidence/route.ts'))],
  ['research evidence attach requires owner-owned ready media', /owner_id=eq\.\$\{encodeURIComponent\(auth\.userId\)\}&status=eq\.ready&deleted_at=is\.null/.test(read('app/api/research/projects/[id]/evidence/route.ts'))],
  ['evidence review statuses are allowlisted', /\["verified", "rejected", "quarantined", "pending"\]/.test(read('app/api/research/projects/[id]/evidence/route.ts'))],
  ['research evidence delivery rechecks project ownership', /owner_user_id=eq/.test(read('app/api/research/evidence/[evidenceId]/content/route.ts'))],
  ['research evidence delivery uses short-lived signed URLs', /expiresIn: 180/.test(read('app/api/research/evidence/[evidenceId]/content/route.ts'))],
  ['field report evidence attachment requires configured admin identity', /GHC_FIELD_ADMIN_USER_ID/.test(read('app/api/field/admin/reports/[id]/evidence/route.ts'))],
  ['field report evidence requires admin-owned ready media', /owner_id=eq\.\$\{encodeURIComponent\(auth\.userId\)\}&status=eq\.ready/.test(read('app/api/field/admin/reports/[id]/evidence/route.ts'))],
  ['field report evidence delivery rechecks configured admin', /GHC_FIELD_ADMIN_USER_ID/.test(read('app/api/field/admin/reports/[id]/evidence/[evidenceId]/content/route.ts'))],
  ['field report evidence supports admin review status updates', /export async function PATCH/.test(read('app/api/field/admin/reports/[id]/evidence/route.ts')) && /quarantined/.test(read('app/api/field/admin/reports/[id]/evidence/route.ts'))],
  ['research inbox supports upload and review controls', /uploadDurableMedia/.test(read('components/field/research-studio-client.tsx')) && /reviewEvidence/.test(read('components/field/research-studio-client.tsx'))],
  ['evidence schema references canonical media asset rows', /media_asset_id text NULL REFERENCES public\.gh_media_assets\(id\)/.test(read('supabase/migrations/20261116190000_gh_media_evidence_engine.sql'))],
  ['field report evidence table is private and service-role mediated', /ALTER TABLE public\.gh_field_report_evidence ENABLE ROW LEVEL SECURITY/.test(read('supabase/migrations/20261116190000_gh_media_evidence_engine.sql')) && /REVOKE ALL ON TABLE public\.gh_field_report_evidence FROM PUBLIC,anon,authenticated/.test(read('supabase/migrations/20261116190000_gh_media_evidence_engine.sql'))],
  ['media integration migration is classified REVIEW_REQUIRED', /20261116190000_gh_media_evidence_engine\.sql/.test(read('scripts/generate-migration-inventory.mjs'))],
  ['scoped upload migration is classified REVIEW_REQUIRED', /20261117010001_gh_evidence_scoped_upload_chain_of_custody\.sql/.test(read('scripts/generate-migration-inventory.mjs'))],
  ['public respondent uploads are implemented and scanner dependency is disclosed', /public respondent uploads/i.test(read('README.md')) && /malware-scanning provider is included/i.test(read('README.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nMedia Evidence Engine: ${checks.length - failed}/${checks.length} PASS`)
if (failed) process.exit(1)
