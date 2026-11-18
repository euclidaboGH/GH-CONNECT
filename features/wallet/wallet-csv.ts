/**
 * RFC 4180-compatible CSV cell encoding with spreadsheet formula-injection protection.
 * Financial exports are presentation-only and never alter ledger values.
 */
export function walletCsvCell(value: unknown): string {
  let text = value == null ? "" : String(value)
  // Numeric ledger amounts remain numeric (including legitimate negatives).
  // Only untrusted textual cells are neutralized against spreadsheet formulas.
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
  // Remove NULs while preserving ordinary whitespace and printable content.
  text = text.replace(/\u0000/g, "")
  return `"${text.replace(/"/g, '""')}"`
}

export function walletCsvRow(values: unknown[]): string {
  return values.map(walletCsvCell).join(",")
}
