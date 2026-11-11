/** Read a request body as UTF-8 text while enforcing a hard streaming byte limit. */
export type BoundedTextResult =
  | { ok: true; text: string }
  | { ok: false; error: "REQUEST_TOO_LARGE" | "INVALID_BODY" }

export async function readBoundedText(request: Request, maxBytes: number): Promise<BoundedTextResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return { ok: false, error: "INVALID_BODY" }
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { ok: false, error: "INVALID_BODY" }
    const length = Number(declared)
    if (!Number.isSafeInteger(length)) return { ok: false, error: "INVALID_BODY" }
    if (length > maxBytes) return { ok: false, error: "REQUEST_TOO_LARGE" }
  }
  if (!request.body) return { ok: true, text: "" }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
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
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, error: "INVALID_BODY" }
  }
}
