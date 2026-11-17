import assert from "node:assert/strict"
import { isBlobUrl, isDurableMediaUrl, isSmallDataUrl, filterDurableUrls } from "../lib/media/durable-url.ts"

const cases = [
  ["https media URL", "https://cdn.example.com/media/abc.webp", true],
  ["same-origin private media facade", "/api/media/asset_123/content", true],
  ["same-origin storage path", "/storage/v1/object/public/posts/a.webp", true],
  ["loopback development URL", "http://localhost:3000/media/a.webp", true],
  ["reject javascript scheme", "javascript:alert(1)", false],
  ["reject vbscript scheme", "vbscript:msgbox(1)", false],
  ["reject file scheme", "file:///etc/passwd", false],
  ["reject blob URL", "blob:https://app.example/123", false],
  ["reject data URL", "data:image/png;base64,AAAA", false],
  ["reject protocol-relative external URL", "//evil.example/asset.png", false],
  ["reject credential-bearing URL", "https://user:pass@cdn.example/a.png", false],
  ["reject non-loopback HTTP", "http://cdn.example.com/a.png", false],
  ["reject placeholder", "https://cdn.example.com/placeholder.webp", false],
  ["reject malformed URL", "https://", false],
  ["reject control chars", "https://cdn.example.com/a\n.png", false],
  ["reject oversize URL", `https://cdn.example.com/${"a".repeat(4000)}`, false],
]
for (const [label, value, expected] of cases) assert.equal(isDurableMediaUrl(value), expected, label)
assert.equal(isBlobUrl("BLOB:https://app.example/123"), true)
assert.equal(isSmallDataUrl("DATA:image/png;base64,AAAA"), true)
assert.deepEqual(filterDurableUrls(["https://cdn.example/a.png", "javascript:alert(1)", "/api/media/id/content"]), ["https://cdn.example/a.png", "/api/media/id/content"])
console.log(`Phase 3 durable media URL policy: ${cases.length + 3}/${cases.length + 3} assertions passed`)
