import fs from "node:fs"
import assert from "node:assert/strict"

const route = fs.readFileSync("app/api/media/route.ts", "utf8")
assert.match(route, /import \{ randomUUID \} from "node:crypto"/)
assert.match(route, /const objectName = `\$\{randomUUID\(\)\}\.\$\{ext\}`/)
assert.match(route, /MEDIA_STORAGE_CONFIGURATION_INVALID/)
assert.match(route, /\^\[a-z0-9\]\[a-z0-9_-\]\{1,61\}\[a-z0-9\]\$/)
assert.match(route, /parseBoundedInteger\(form\.get\("width"\), 20_000\)/)
assert.match(route, /parseBoundedInteger\(form\.get\("height"\), 20_000\)/)
assert.match(route, /12 \* 60 \* 60 \* 1000/)
assert.match(route, /INVALID_MEDIA_METADATA/)
assert.match(route, /if \(!input\.startsWith|void form\.get\("ownerId"\)/)
assert.match(route, /Validate actual bytes, not just the browser-provided MIME type/)
assert.match(route, /The media service could not complete this upload\. Please try again\./)
assert.doesNotMatch(route, /message:\s*e instanceof Error \? e\.message/)
console.log("Media route hardening source checks: 12/12 passed")
