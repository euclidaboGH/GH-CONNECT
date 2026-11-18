/** Composer helpers; message delivery, membership and moderation remain server-enforced. */
export const CHAT_TEXT_LIMIT = 4000
export function normalizeMessageDraft(value: unknown): string { return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, CHAT_TEXT_LIMIT) }
export function validateMessageDraft(value: unknown): 'empty' | 'too_long' | 'valid' { const text = String(value ?? '').trim(); return !text ? 'empty' : text.length > CHAT_TEXT_LIMIT ? 'too_long' : 'valid' }
export function normalizeMessageSearch(value: unknown): string { return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) }
export function stableOfflineMessageId(actionId: unknown): string { const id = String(actionId ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96); return id ? `offline-${id}` : '' }
export function messagePreview(value: unknown, max = 96): string { return normalizeMessageDraft(value).replace(/\s+/g, ' ').trim().slice(0, Math.max(1, Math.min(240, max))) }
