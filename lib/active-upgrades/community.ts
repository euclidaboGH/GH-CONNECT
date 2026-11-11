/** Community UX guardrails. These helpers shape presentation only; server policy remains authoritative. */
const MAX_QUERY = 120
export function normalizeCommunitySearch(value: unknown): string { return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY) }
export function clampCommunityPage(value: unknown, size = 24): number { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(Math.floor(n / Math.max(1, size)), 500) : 0 }
export function safeCommunityResourceUrl(value: unknown): string | null { try { const u = new URL(String(value ?? '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : null } catch { return null } }
export function communityActivityLabel(posts: unknown, members: unknown): string { const p = Number(posts), m = Number(members); if (!Number.isFinite(p) || !Number.isFinite(m) || p < 0 || m < 0) return 'Activity unavailable'; return p === 0 ? 'Getting started' : `${Math.floor(p)} recent posts · ${Math.floor(m)} members` }
export function canShowCommunityChat(input: { isMember?: boolean; chatEnabled?: boolean; revoked?: boolean }): boolean { return input.isMember === true && input.chatEnabled === true && input.revoked !== true }
