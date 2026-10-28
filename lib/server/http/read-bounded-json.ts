/** Read and parse a small JSON request while enforcing a hard streaming byte limit. */
export type BoundedJsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: "REQUEST_TOO_LARGE" | "INVALID_JSON" | "INVALID_BODY" }

export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return { ok: false, error: "INVALID_BODY" }
  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, error: "INVALID_BODY" }
    const parsedLength = Number(declaredLength)
    if (!Number.isSafeInteger(parsedLength)) return { ok: false, error: "INVALID_BODY" }
    if (parsedLength > maxBytes) return { ok: false, error: "REQUEST_TOO_LARGE" }
  }

  if (!request.body) return { ok: false, error: "INVALID_BODY" }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel("request body exceeds configured limit").catch(() => undefined)
        return { ok: false, error: "REQUEST_TOO_LARGE" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, error: "INVALID_BODY" }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let raw: string
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return { ok: false, error: "INVALID_JSON" }
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false, error: "INVALID_JSON" }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "INVALID_BODY" }
  }
  return { ok: true, value: value as Record<string, unknown> }
}
