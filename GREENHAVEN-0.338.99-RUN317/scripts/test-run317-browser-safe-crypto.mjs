#!/usr/bin/env node
/** Run #317 runtime checks for cross-runtime cryptographic ID helpers. */
import assert from "node:assert/strict"
import { secureHex, securePrefixedId, secureUUID } from "../lib/secure-id.ts"

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS ${name}`)
}

check("secure UUID is RFC 4122 version 4", () => assert.match(secureUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
check("secure UUIDs are independently generated", () => assert.notEqual(secureUUID(), secureUUID()))
check("prefixed IDs sanitize untrusted prefix characters", () => assert.match(securePrefixedId("user id/../"), /^userid_[0-9a-f-]{36}$/i))
check("default secure hex uses 16 bytes", () => assert.match(secureHex(), /^[0-9a-f]{32}$/i))
check("secure hex honors requested byte count", () => assert.match(secureHex(8), /^[0-9a-f]{16}$/i))
check("secure hex clamps oversized byte requests", () => assert.match(secureHex(1000), /^[0-9a-f]{128}$/i))
check("secure hex clamps zero to one byte", () => assert.match(secureHex(0), /^[0-9a-f]{2}$/i))

console.log(`\nRun #317 Web Crypto runtime: ${passed}/7 passed`)
