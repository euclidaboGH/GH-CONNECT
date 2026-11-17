import assert from 'node:assert/strict'
import { evidenceSignatureMatches } from '../lib/server/evidence/file-signature.mjs'
const cases = [
  ['image/jpeg', [0xff,0xd8,0xff,0x00], true],
  ['image/png', [137,80,78,71,13,10,26,10], true],
  ['image/gif', [...Buffer.from('GIF89a')], true],
  ['image/webp', [...Buffer.from('RIFF0000WEBP')], true],
  ['image/avif', [...Buffer.from('0000ftypavif')], true],
  ['video/mp4', [...Buffer.from('0000ftypisom')], true],
  ['video/webm', [0x1a,0x45,0xdf,0xa3], true],
  ['application/pdf', [...Buffer.from('%PDF-1.7')], true],
  ['audio/wav', [...Buffer.from('RIFF0000WAVE')], true],
  ['audio/ogg', [...Buffer.from('OggS')], true],
  ['audio/flac', [...Buffer.from('fLaC')], true],
  ['audio/mpeg', [...Buffer.from('ID3')], true],
  ['audio/aac', [0xff,0xf1,0x50], true],
  ['image/png', [...Buffer.from('%PDF-')], false],
  ['application/pdf', [...Buffer.from('hello')], false],
  ['application/x-executable', [0x7f,0x45,0x4c,0x46], false],
]
for (const [mime, bytes, expected] of cases) assert.equal(evidenceSignatureMatches(mime, Buffer.from(bytes)), expected, `${mime} signature`)
console.log(`Evidence file signature tests: ${cases.length}/${cases.length} PASS`)
