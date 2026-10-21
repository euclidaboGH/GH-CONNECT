#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let f = 0
const ok = (c, m) => { if (c) console.log("PASS", m); else { console.log("FAIL", m); f++ } }
ok(existsSync("app/api/media/direct-upload-intent/route.ts"), "intent route")
ok(existsSync("app/api/media/direct-upload-complete/route.ts"), "complete route")
const up = readFileSync("lib/media/upload-client.ts", "utf8")
ok(up.includes("uploadViaDirect"), "direct client path")
ok(up.includes("MAX_DIRECT_VIDEO_BYTES = 40 * 1024 * 1024"), "40MB video limit")
ok(up.includes("SAFE_PROXY_UPLOAD_BYTES"), "proxy threshold")
ok(up.includes("category: meta?.category"), "category sent to direct upload intent")
ok(readFileSync("app/api/media/route.ts", "utf8").includes("MAX_VIDEO_BYTES = 40 * 1024 * 1024"), "server proxy video limit is 40MB")
ok(readFileSync("app/api/media/direct-upload-intent/route.ts", "utf8").includes("MAX_VIDEO_BYTES = 40 * 1024 * 1024"), "server direct video limit is 40MB")
ok(readFileSync("app/api/media/direct-upload-complete/route.ts", "utf8").includes("category !== expectedCategory"), "completion validates category path")
ok(readFileSync("lib/server/media/ensure-bucket.ts", "utf8").includes("file_size_limit: 52428800"), "new buckets default to 50MB cap")
ok(readFileSync("app/api/media/route.ts", "utf8").includes("audio/flac"), "server accepts configured audio MIME types")
for (const folder of ["audio", "documents", "avatars", "images", "videos"]) {
  ok(readFileSync("app/api/media/direct-upload-intent/route.ts", "utf8").includes(`"${folder}"`), `direct upload supports ${folder} category`)
}
ok(readFileSync("app/api/media/direct-upload-intent/route.ts", "utf8").includes('buildOwnedMediaPath(auth.userId, category, objectName)'), "direct upload uses owner-first canonical storage paths")
ok(!readFileSync("app/api/media/direct-upload-intent/route.ts", "utf8").includes("application/x-pdf"), "PDF MIME allowlist matches Supabase")
ok(readFileSync("app/api/media/route.ts", "utf8").includes('buildOwnedMediaPath(auth.userId, category, objectName)'), "proxy upload uses owner-first canonical storage paths")
const c = readFileSync("components/ghc/unified-compose.tsx", "utf8")
ok(c.includes("40 MB") || c.includes("40MB") || c.includes("40 * 1024"), "compose video limit is 40MB")
ok(!c.includes("videos currently up to 4 MB"), "old 4MB copy removed")
ok(existsSync("components/ghc/daily-claim-prompt.tsx"), "daily claim prompt")
ok(readFileSync("components/ghc/app.tsx", "utf8").includes("DailyClaimPrompt"), "prompt wired")
if (f) process.exit(1)
console.log("\nMEDIA + CLAIM upgrades: all checks passed")
