/**
 * Age is derived from date of birth. Never store a permanent "age" alone
 * for discovery math — it drifts as birthdays pass.
 */

export function ageFromBornDate(bornDate: string | null | undefined, now = new Date()): number | null {
  if (!bornDate || !/^\d{4}-\d{2}-\d{2}$/.test(bornDate)) return null
  const [y, m, d] = bornDate.split("-").map(Number)
  const birth = new Date(y, m - 1, d)
  if (Number.isNaN(birth.getTime())) return null
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1
  if (age < 0 || age > 120) return null
  return age
}

export function isAdultFromBornDate(bornDate: string, minAge = 18): boolean {
  const age = ageFromBornDate(bornDate)
  return age !== null && age >= minAge
}

export function maxBornDateForMinAge(minAge = 18, now = new Date()): string {
  const y = now.getFullYear() - minAge
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
