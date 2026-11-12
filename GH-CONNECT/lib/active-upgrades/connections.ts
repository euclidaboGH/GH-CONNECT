/** Connection presentation and input normalization; never grants relationship authority. */
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/
export function normalizeConnectionTarget(value: unknown): string | null { const id = String(value ?? '').trim(); return ID.test(id) && !/^demo|placeholder|anonymous$/i.test(id) ? id : null }
export function canRequestConnection(input: { viewerId?: string; targetId?: string; blocked?: boolean; pending?: boolean }): boolean { const a = normalizeConnectionTarget(input.viewerId), b = normalizeConnectionTarget(input.targetId); return Boolean(a && b && a !== b && input.blocked !== true && input.pending !== true) }
export function normalizeConnectionIntentIds(value: unknown, allowed: readonly string[]): string[] { if (!Array.isArray(value)) return []; const set = new Set(allowed); return [...new Set(value.map(x => String(x).trim()).filter(x => set.has(x)))].slice(0, 20) }
export function mutualConnectionCount(value: unknown): number { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(1_000_000, Math.floor(n)) : 0 }
export function connectionStatusLabel(value: unknown): string { const s = String(value ?? '').toLowerCase(); return ({ connected: 'Connected', pending: 'Request pending', incoming: 'Respond to request', blocked: 'Unavailable', following: 'Following' } as Record<string,string>)[s] ?? 'Not connected' }
