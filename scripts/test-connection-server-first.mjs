#!/usr/bin/env node
import { readFileSync } from "node:fs"
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}
const uni = readFileSync("lib/domains/adapters/unified-connection-request.ts", "utf8")
ok(uni.includes("credentials: \"include\""), "postJson sends credentials")
ok(uni.includes("getAuthHeaders"), "postJson sends auth headers")
ok(uni.includes("Server-first"), "send marked server-first")
ok(uni.includes("REQUEST_NOT_DURABLE") || uni.includes("REQUEST_FAILED"), "fails if not durable")
const sendIdx = uni.indexOf("export async function sendUnifiedConnectionRequest")
const acceptIdx = uni.indexOf("export async function acceptUnifiedConnectionRequest")
const sendBody = uni.slice(sendIdx, acceptIdx)
ok(sendBody.indexOf("postJson(\"/api/connections/request\"") < sendBody.indexOf("sendFriendRequest"), "API before session graph on send")
const accBody = uni.slice(acceptIdx, uni.indexOf("export async function declineUnifiedConnectionRequest"))
ok(accBody.indexOf("postJson(\"/api/connections/accept\"") < accBody.indexOf("acceptFriendRequest"), "API before session graph on accept")

const ctx = readFileSync("contexts/ghc-context.tsx", "utf8")
const fStart = ctx.indexOf("const followUser = useCallback")
const fEnd = ctx.indexOf("const addFriend = useCallback")
const fBody = ctx.slice(fStart, fEnd)
ok(fBody.indexOf("socialFollow") < fBody.indexOf("toggleFollow"), "follow: API before domain toggle")
ok(fBody.includes("durable === false") || fBody.includes("!remote.ok"), "follow rejects non-durable")

const aStart = ctx.indexOf("const addFriend = useCallback")
const aEnd = ctx.indexOf("const reportUser = useCallback")
const aBody = ctx.slice(aStart, aEnd)
ok(aBody.indexOf("socialConnectionRequest") < aBody.indexOf("sendFriendRequest"), "connect: API before domain")
ok(aBody.includes("!remote.ok || !remote.durable"), "connect requires durable")

if (failed) {
  console.log(`\nCONNECTION SERVER-FIRST: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nCONNECTION SERVER-FIRST: all checks passed")
