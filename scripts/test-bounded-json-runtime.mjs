#!/usr/bin/env node
/** Runtime tests for the shared bounded JSON reader; run with --experimental-strip-types on Node 22. */
import assert from 'node:assert/strict'
import { readBoundedJson } from '../lib/server/http/read-bounded-json.ts'

const bytes = (text) => new TextEncoder().encode(text)
const request = (chunks, headers = {}) => new Request('http://localhost/test', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: new ReadableStream({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() },
  }),
  duplex: 'half',
})
const cases = []
async function check(name, fn) { await fn(); cases.push(name); console.log(`PASS ${name}`) }

await check('valid JSON object parses', async () => {
  const result = await readBoundedJson(request([bytes('{"ok":true}')]), 32)
  assert.deepEqual(result, { ok: true, value: { ok: true } })
})
await check('oversized declared content-length rejects before reading', async () => {
  const result = await readBoundedJson(request([bytes('{}')], { 'content-length': '100' }), 8)
  assert.deepEqual(result, { ok: false, error: 'REQUEST_TOO_LARGE' })
})
await check('actual streamed bytes enforce limit despite a smaller declared length', async () => {
  const result = await readBoundedJson(request([bytes('{"value":"more than limit"}')], { 'content-length': '2' }), 8)
  assert.deepEqual(result, { ok: false, error: 'REQUEST_TOO_LARGE' })
})
await check('malformed JSON rejects', async () => {
  const result = await readBoundedJson(request([bytes('{broken')]), 32)
  assert.deepEqual(result, { ok: false, error: 'INVALID_JSON' })
})
await check('array JSON rejects as invalid body', async () => {
  const result = await readBoundedJson(request([bytes('[1,2]')]), 32)
  assert.deepEqual(result, { ok: false, error: 'INVALID_BODY' })
})
await check('scalar JSON rejects as invalid body', async () => {
  const result = await readBoundedJson(request([bytes('null')]), 32)
  assert.deepEqual(result, { ok: false, error: 'INVALID_BODY' })
})
await check('invalid UTF-8 rejects rather than replacement-decoding', async () => {
  const result = await readBoundedJson(request([new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])]), 32)
  assert.deepEqual(result, { ok: false, error: 'INVALID_JSON' })
})
await check('invalid configured limit rejects', async () => {
  const result = await readBoundedJson(request([bytes('{}')]), 0)
  assert.deepEqual(result, { ok: false, error: 'INVALID_BODY' })
})
await check('bodyless request rejects', async () => {
  const result = await readBoundedJson(new Request('http://localhost/test', { method: 'POST' }), 32)
  assert.deepEqual(result, { ok: false, error: 'INVALID_BODY' })
})
console.log(`\nBounded JSON runtime tests: ${cases.length}/9 passed`)
