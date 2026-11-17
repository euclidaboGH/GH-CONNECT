import assert from 'node:assert/strict'
import { reconcileAttachmentWithAsset, sanitizeAttachmentFileName } from '../lib/server/media/message-attachment-policy.ts'

let passed = 0
function check(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`) }
const OWNER = 'user_a'
const declared = { id: 'media_x_y', type: 'file', url: '/api/media/media_x_y/content', mimeType: 'application/pdf', sizeBytes: 1 }
const asset = (o = {}) => ({ owner_id: OWNER, status: 'ready', deleted_at: null, mime_type: 'image/png', byte_size: 2048, media_kind: 'image', ...o })

check('accepts owned ready PNG and overrides client type/mime/size', () => {
  const r = reconcileAttachmentWithAsset(declared, asset(), OWNER)
  assert.ok(r.ok); assert.equal(r.attachment.type, 'image'); assert.equal(r.attachment.mimeType, 'image/png'); assert.equal(r.attachment.sizeBytes, 2048)
})
check('rejects non-owner asset', () => assert.equal(reconcileAttachmentWithAsset(declared, asset({ owner_id: 'user_b' }), OWNER).error, 'ATTACHMENT_NOT_OWNED'))
check('rejects pending asset', () => assert.equal(reconcileAttachmentWithAsset(declared, asset({ status: 'pending' }), OWNER).error, 'ATTACHMENT_NOT_OWNED'))
check('rejects deleted asset', () => assert.equal(reconcileAttachmentWithAsset(declared, asset({ deleted_at: '2026-01-01' }), OWNER).error, 'ATTACHMENT_NOT_OWNED'))
check('rejects executable/HTML/SVG mime', () => {
  for (const m of ['text/html', 'image/svg+xml', 'application/x-msdownload', 'application/javascript', 'application/zip', ''])
    assert.equal(reconcileAttachmentWithAsset(declared, asset({ mime_type: m, media_kind: undefined }), OWNER).error, 'ATTACHMENT_TYPE_NOT_ALLOWED')
})
check('rejects kind/mime mismatch', () => assert.equal(reconcileAttachmentWithAsset(declared, asset({ media_kind: 'video' }), OWNER).error, 'ATTACHMENT_TYPE_NOT_ALLOWED'))
check('rejects zero/negative/non-integer size', () => {
  for (const n of [0, -5, 1.5, 'abc', null]) assert.equal(reconcileAttachmentWithAsset(declared, asset({ byte_size: n }), OWNER).error, 'ATTACHMENT_TOO_LARGE')
})
check('enforces 40 MiB video cap', () => {
  assert.equal(reconcileAttachmentWithAsset(declared, asset({ mime_type: 'video/mp4', media_kind: 'video', byte_size: 40 * 1024 * 1024 + 1 }), OWNER).error, 'ATTACHMENT_TOO_LARGE')
  assert.ok(reconcileAttachmentWithAsset(declared, asset({ mime_type: 'video/mp4', media_kind: 'video', byte_size: 40 * 1024 * 1024 }), OWNER).ok)
})
check('enforces 50 MiB image/pdf cap', () => {
  assert.equal(reconcileAttachmentWithAsset(declared, asset({ byte_size: 50 * 1024 * 1024 + 1 }), OWNER).error, 'ATTACHMENT_TOO_LARGE')
  assert.ok(reconcileAttachmentWithAsset(declared, asset({ mime_type: 'application/pdf', media_kind: 'file', byte_size: 50 * 1024 * 1024 }), OWNER).ok)
})
check('audio classified as file', () => assert.equal(reconcileAttachmentWithAsset(declared, asset({ mime_type: 'audio/mpeg', media_kind: 'file' }), OWNER).attachment.type, 'file'))
check('sanitizes file names', () => {
  assert.equal(sanitizeAttachmentFileName('../../etc/passwd'), '.._.._etc_passwd')
  assert.equal(sanitizeAttachmentFileName('a\u202Eexe.pdf\u0000'), 'aexe.pdf')
  assert.equal(sanitizeAttachmentFileName('   '), undefined)
  assert.equal(sanitizeAttachmentFileName('x'.repeat(500)).length, 180)
})
process.stdout.write(`${passed}/${passed} passed\n`)
