import assert from 'node:assert/strict'

class TestCustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail }
}
globalThis.CustomEvent = TestCustomEvent
globalThis.window = new EventTarget()

let fetchCount = 0
let pendingFetch = null
globalThis.fetch = async () => {
  fetchCount += 1
  if (pendingFetch) return pendingFetch
  return new Response(JSON.stringify({ ok: true, url: `https://storage.example.test/signed-${fetchCount}`, expiresIn: 300 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const { setDisplayMediaViewer, resolveDisplayMediaUrl } = await import('../lib/media/resolve-display-url.ts')
const media = '/api/media/media_private_123/content'

setDisplayMediaViewer('user-a', 'authenticated')
const first = await resolveDisplayMediaUrl(media)
assert.equal(first, 'https://storage.example.test/signed-1')
assert.equal(fetchCount, 1)

// Same viewer reuses the short-lived URL, but a different account must resolve again.
const cached = await resolveDisplayMediaUrl(media)
assert.equal(cached, first)
assert.equal(fetchCount, 1)
setDisplayMediaViewer('user-b', 'authenticated')
const second = await resolveDisplayMediaUrl(media)
assert.equal(second, 'https://storage.example.test/signed-2')
assert.equal(fetchCount, 2)
assert.notEqual(second, first)

// A response started for an old identity must never be returned after a switch.
let release
pendingFetch = new Promise((resolve) => { release = resolve })
const staleRequest = resolveDisplayMediaUrl('/api/media/media_private_456/content')
setDisplayMediaViewer('user-c', 'authenticated')
release(new Response(JSON.stringify({ ok: true, url: 'https://storage.example.test/stale-user-b', expiresIn: 300 }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
}))
assert.equal(await staleRequest, null)
pendingFetch = null
const fresh = await resolveDisplayMediaUrl('/api/media/media_private_456/content')
assert.equal(fresh, 'https://storage.example.test/signed-4')
assert.equal(fetchCount, 4)

console.log('Phase 18 media session cache runtime: PASS (same-viewer cache, account isolation, stale in-flight rejection)')
