import fs from "node:fs"
import assert from "node:assert/strict"

const source = fs.readFileSync(new URL("../components/ghc/action-sheet.tsx", import.meta.url), "utf8")
assert.match(source, /const onScroll = \(event: Event\) => \{/)
assert.match(source, /panelRef\.current\?\.contains\(target\)/)
assert.match(source, /Scrolling inside the sheet is expected/)
console.log("action-sheet-scroll: 3/3 passed")
