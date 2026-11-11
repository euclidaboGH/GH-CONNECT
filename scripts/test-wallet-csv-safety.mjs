import assert from "node:assert/strict"
import { walletCsvCell, walletCsvRow } from "../features/wallet/wallet-csv.ts"

assert.equal(walletCsvCell("ordinary, text"), '"ordinary, text"')
assert.equal(walletCsvCell('say "hello"'), '"say ""hello"""')
assert.equal(walletCsvCell("line1\nline2"), '"line1\nline2"')
assert.equal(walletCsvCell('=HYPERLINK("https://evil.example")'), `"'=HYPERLINK(""https://evil.example"")"`)
assert.equal(walletCsvCell("  +SUM(A1:A2)"), `"'  +SUM(A1:A2)"`)
assert.equal(walletCsvCell(-12.5), '"-12.5"')
assert.equal(walletCsvCell(0), '"0"')
assert.equal(walletCsvCell(null), '""')
assert.equal(walletCsvRow(["id", "reason, detail", -1]), '"id","reason, detail","-1"')
console.log("Wallet CSV safety: 9/9 passed")
