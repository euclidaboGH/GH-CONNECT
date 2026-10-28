#!/usr/bin/env node
/** Validate a redacted restore-drill evidence JSON record; never connects to a database. */
import { readFileSync, lstatSync, openSync, fstatSync, closeSync, constants } from 'node:fs'
import { resolve } from 'node:path'

const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith('-'))
if (!fileArg || process.argv.includes('--help')) {
  console.log('Usage: node scripts/validate-database-restore-evidence.mjs <redacted-restore-evidence.json>')
  console.log('Validates evidence completeness only. It does not prove or execute a restore.')
  process.exit(fileArg ? 0 : 2)
}
let record
try {
  const file = resolve(fileArg)
  // Refuse symlinks at open time as well as during preflight. O_NOFOLLOW closes
  // the lstat/read TOCTOU window on platforms that support it; fstat verifies
  // the opened descriptor is still a regular file before reading any bytes.
  const before = lstatSync(file)
  if (before.isSymbolicLink() || !before.isFile()) throw new Error('not a regular, non-symlink file')
  const noFollow = constants.O_NOFOLLOW ?? 0
  const fd = openSync(file, constants.O_RDONLY | noFollow)
  try {
    const opened = fstatSync(fd)
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error('evidence file changed during secure open')
    }
    if (opened.size > 256 * 1024) throw new Error('evidence JSON exceeds 256 KiB limit')
    record = JSON.parse(readFileSync(fd, 'utf8'))
  } finally {
    closeSync(fd)
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('top-level JSON value must be an object')
} catch (error) {
  const detail = error instanceof Error && error.code === 'ELOOP'
    ? 'not a regular, non-symlink file'
    : error instanceof Error ? error.message : 'unknown error'
  console.error(`FAIL cannot read valid evidence JSON: ${detail}`)
  process.exit(1)
}
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0
// Require an explicit timezone and reject Date.parse's normalization of impossible dates.
const isoDate = (v) => {
  if (!nonEmpty(v) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return false
  const timestamp = Date.parse(v)
  if (!Number.isFinite(timestamp)) return false
  const datePart = v.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = v.slice(11, 19).split(':').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  const offset = v.match(/([+-])(\d{2}):(\d{2})$/)
  if (offset && (Number(offset[2]) > 14 || Number(offset[3]) > 59 || (Number(offset[2]) === 14 && Number(offset[3]) !== 0))) return false
  return true
}
const uniqueNamedChecks = (items) => {
  if (!Array.isArray(items)) return false
  const names = items.map((item) => typeof item?.name === 'string' ? item.name.trim().toLocaleLowerCase('en-US') : '')
  return names.every(Boolean) && new Set(names).size === names.length
}
const independentReviewer = (value) => nonEmpty(value) && !/(same operator|self.review|not independent|unreviewed|unknown|tbd|todo)/i.test(value)
const containsSecretMaterial = (value) => {
  // Reject both secret-shaped field names and accidental raw connection/token material.
  const serialized = JSON.stringify(value)
  return /\"[^\"]*(?:database_url|connection_string|password|secret|service_role_key|access_token|refresh_token|private_key|client_secret|api_key|secret_key|authorization|jwt)[^\"]*\"\s*:/i.test(serialized)
    || /(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s\"']+/i.test(serialized)
    || /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i.test(serialized)
    // Catch compact JWTs even when an operator accidentally pastes one without a Bearer prefix.
    || /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(serialized)
    || /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i.test(serialized)
    || /(?:https?|wss?):\/\/[^\s\/@:]+:[^\s\/@]+@/i.test(serialized)
    // Common provider/API token prefixes should never appear in an evidence artifact.
    || /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/.test(serialized)
    // URLs may leak secrets through query parameters even without userinfo credentials.
    || /https?:\/\/[^\s"']+[?&](?:access_?token|api_?key|auth(?:orization)?|client_?secret|password|refresh_?token|secret|signature|token)=([^&\s"']{4,})/i.test(serialized)
}
const checks = [
  ['schema_version is 1', record?.schema_version === 1],
  ['environment is explicitly disposable', record?.environment === 'disposable'],
  ['production credentials were not used', record?.production_credentials_used === false],
  ['backup SHA-256 is 64 lowercase hex characters', typeof record?.backup_sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.backup_sha256)],
  ['PostgreSQL version is recorded in a recognizable form', typeof record?.postgres_version === 'string' && /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:[-+][A-Za-z0-9.-]+)?$/.test(record.postgres_version.trim())],
  ['restore start and finish timestamps are ISO strings', isoDate(record?.restore_started_at) && isoDate(record?.restore_finished_at)],
  ['restore finish is not before start', isoDate(record?.restore_started_at) && isoDate(record?.restore_finished_at) && Date.parse(record.restore_finished_at) >= Date.parse(record.restore_started_at)],
  ['restore status is pass or fail', ['pass', 'fail'].includes(record?.restore_status)],
  ['integrity checks are recorded with unique names', Array.isArray(record?.integrity_checks) && record.integrity_checks.length > 0 && record.integrity_checks.every((x) => nonEmpty(x?.name) && ['pass', 'fail', 'not_run'].includes(x?.status)) && uniqueNamedChecks(record.integrity_checks)],
  ['application smoke tests are recorded with unique names', Array.isArray(record?.smoke_tests) && record.smoke_tests.length > 0 && record.smoke_tests.every((x) => nonEmpty(x?.name) && ['pass', 'fail', 'not_run'].includes(x?.status)) && uniqueNamedChecks(record.smoke_tests)],
  ['actual RPO and RTO measurements are present or explicitly null', (record?.actual_rpo_seconds === null || (Number.isSafeInteger(record?.actual_rpo_seconds) && record.actual_rpo_seconds >= 0)) && (record?.actual_rto_seconds === null || (Number.isSafeInteger(record?.actual_rto_seconds) && record.actual_rto_seconds >= 0))],
  ['independent reviewer and review timestamp are recorded', independentReviewer(record?.review?.reviewer_role) && isoDate(record?.review?.reviewed_at)],
  ['review occurred after restore completion', isoDate(record?.restore_finished_at) && isoDate(record?.review?.reviewed_at) && Date.parse(record.review.reviewed_at) >= Date.parse(record.restore_finished_at)],
  ['successful drill includes measured RPO and RTO', record?.restore_status !== 'pass' || (Number.isSafeInteger(record?.actual_rpo_seconds) && record.actual_rpo_seconds >= 0 && Number.isSafeInteger(record?.actual_rto_seconds) && record.actual_rto_seconds >= 0)],
  ['evidence contains no credential fields, raw connection URLs, bearer tokens, or private keys', !containsSecretMaterial(record)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Restore evidence completeness: ${checks.length - failed}/${checks.length} checks passed`)
if (failed) process.exit(1)
if (record.restore_status !== 'pass' || record.integrity_checks.some((x) => x.status !== 'pass') || record.smoke_tests.some((x) => x.status !== 'pass')) {
  console.error('FAIL evidence is complete but the restore drill did not fully pass')
  process.exit(1)
}
console.log('PASS evidence is complete and all recorded checks passed; independent operational verification is still required')
