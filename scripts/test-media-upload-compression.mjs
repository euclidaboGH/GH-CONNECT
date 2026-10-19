import fs from "node:fs"
import assert from "node:assert/strict"

const upload = fs.readFileSync("lib/media/upload-client.ts", "utf8")
const copy = fs.readFileSync("lib/media/user-messages.ts", "utf8")

assert.match(upload, /MAX_PROXY_UPLOAD_BYTES = 4 \* 1024 \* 1024/)
assert.match(upload, /SAFE_PROXY_UPLOAD_BYTES = 3\.75 \* 1024 \* 1024/)
assert.match(upload, /compressOversizedImage/)
assert.match(upload, /uploadFile\.type\.startsWith\("image\/"\)/)
assert.match(upload, /meta\?\.onProgress\?\.\("Compressing photo…"\)/)
assert.match(upload, /candidate\.size <= SAFE_PROXY_UPLOAD_BYTES/)
assert.match(upload, /sourceMaxDimension, 1920, 1600, 1280, 1024, 900, 720, 640, 512, 400/)
assert.match(upload, /uploadFile\.size > MAX_PROXY_UPLOAD_BYTES/)
assert.match(upload, /typeof source\.close === "function"/)
assert.match(upload, /URL\.revokeObjectURL\(objectUrl\)/)
assert.match(upload, /MEDIA_DIRECT_UPLOAD_REQUIRED/)
assert.match(copy, /still too large for the current upload route after optimization/)
console.log("Media upload compression source checks: 12/12 passed")
