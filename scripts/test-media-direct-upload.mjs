#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let f = 0
const ok = (c, m) => { if (c) console.log("PASS", m); else { console.log("FAIL", m); f++ } }
ok(existsSync("app/api/media/direct-upload-intent/route.ts"), "intent route")
ok(existsSync("app/api/media/direct-upload-complete/route.ts"), "complete route")
const up = readFileSync("lib/media/upload-client.ts", "utf8")
ok(up.includes("uploadViaDirect"), "direct client path")
ok(up.includes("MAX_DIRECT_VIDEO_BYTES = 80"), "80MB video")
ok(up.includes("SAFE_PROXY_UPLOAD_BYTES"), "proxy threshold")
const c = readFileSync("components/ghc/unified-compose.tsx", "utf8")
ok(c.includes("80 MB") || c.includes("80MB") || c.includes("80 * 1024"), "compose larger limits")
ok(!c.includes("videos currently up to 4 MB"), "old 4MB copy removed")
ok(existsSync("components/ghc/daily-claim-prompt.tsx"), "daily claim prompt")
ok(readFileSync("components/ghc/app.tsx", "utf8").includes("DailyClaimPrompt"), "prompt wired")
if (f) process.exit(1)
console.log("\nMEDIA + CLAIM upgrades: all checks passed")
