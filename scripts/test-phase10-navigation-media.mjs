import assert from "node:assert/strict"
import { optimizedImageUrl, createScrollLoadMore } from "../lib/mobile-performance.ts"

// Signed provider URLs and private facade paths must remain unchanged.
const signed = "https://storage.example.test/object?token=abc%2F123&expires=1700000000"
assert.equal(optimizedImageUrl(signed, 480), signed)
assert.equal(optimizedImageUrl("/api/media/media_123/content", 720), "/api/media/media_123/content")
assert.equal(optimizedImageUrl("blob:local-preview", 480), "blob:local-preview")
assert.equal(optimizedImageUrl(null, 480), "/placeholder.svg?height=320&width=320")

// Infinite-scroll requests remain locked until the in-flight page load settles.
let resolveLoad
let calls = 0
const pending = new Promise((resolve) => { resolveLoad = resolve })
const onScroll = createScrollLoadMore({
  thresholdPx: 400,
  onLoadMore: () => { calls += 1; return pending },
  hasMore: () => true,
})
const event = { currentTarget: { scrollHeight: 1000, scrollTop: 700, clientHeight: 500 } }
onScroll(event)
onScroll(event)
await Promise.resolve()
assert.equal(calls, 1, "concurrent scroll events must not enqueue duplicate page loads")
resolveLoad()
await new Promise((resolve) => setImmediate(resolve))
onScroll(event)
await Promise.resolve()
assert.equal(calls, 2, "a later page load should be allowed after the previous request settles")

console.log("Phase 10 navigation/media runtime tests: 7/7 passed")
