/**
 * Foundation helpers — additive, non-breaking.
 * Prefer existing domain modules (economy/auth, membership, payments) for business rules.
 */
export { getRequestContext, requestIdHeaders, type RequestContext } from "./request-context"
export { PAGINATION, clampLimit, sanitizeCursor } from "./pagination"
export { requireSameUser, isSameUser } from "./authorization"
export { normalizeIdempotencyKey, buildScopedReference } from "./idempotency"
