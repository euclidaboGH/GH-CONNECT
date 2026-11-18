import fs from "node:fs"
import assert from "node:assert/strict"

const countriesSource = fs.readFileSync("lib/geography/countries.ts", "utf8")
const languageSource = fs.readFileSync("lib/geography/country-languages.ts", "utf8")
const catalogSource = fs.readFileSync("lib/geography/catalog.ts", "utf8")
const pickerSource = fs.readFileSync("components/ghc/location-picker.tsx", "utf8")
const indexSource = fs.readFileSync("lib/geography/index.ts", "utf8")

const countries = [...countriesSource.matchAll(/\{ id: "([a-z]{2})", name: "([^"]+)", iso2: "([A-Z]{2})", continent: "(AF|AS|EU|NA|SA|OC)"[^\n]*defaultTimezone: "([^"]+)" \}/g)]
assert.equal(countries.length, 60, `Expected 60 canonical countries, found ${countries.length}`)

const ids = new Set()
const isoCodes = new Set()
const counts = new Map()
const original36 = [
  "ng", "eg", "za", "ke", "gh", "ma",
  "cn", "in", "jp", "kr", "id", "sa",
  "gb", "fr", "de", "it", "es", "nl",
  "us", "ca", "mx", "cu", "jm", "cr",
  "br", "ar", "co", "cl", "pe", "ve",
  "au", "nz", "pg", "fj", "ws", "to",
]
for (const [, id, name, iso2, continent, timeZone] of countries) {
  assert.equal(id, iso2.toLowerCase(), `${name}: country id must remain lowercase ISO2`)
  assert.ok(!ids.has(id), `Duplicate country id: ${id}`)
  assert.ok(!isoCodes.has(iso2), `Duplicate ISO2 code: ${iso2}`)
  ids.add(id)
  isoCodes.add(iso2)
  counts.set(continent, (counts.get(continent) || 0) + 1)
  assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone }), `${name}: invalid IANA timezone ${timeZone}`)
}
for (const id of original36) assert.ok(ids.has(id), `Original country ${id} must be retained`)
for (const continent of ["AF", "AS", "EU", "NA", "SA", "OC"]) {
  assert.equal(counts.get(continent), 10, `${continent} must contain exactly 10 countries`)
}

const recommendations = [...languageSource.matchAll(/^\s*\{ countryId: "([a-z]{2})", languageCode: "([a-z]{2,3})", localeTag: "([A-Za-z0-9-]+)", direction: "(ltr|rtl)", name: "([^"]+)", nativeName: (null|"[^"]*"), category: "([a-z-]+)", reviewStatus: "(pending|reviewed|approved)", note: "([^"]*)" \},$/gm)]
assert.equal(recommendations.length, 240, `Expected 240 country-language recommendations, found ${recommendations.length}`)
const perCountry = new Map()
const recommendationKeys = new Set()
for (const [, countryId, languageCode, localeTag, direction, name, , category, reviewStatus] of recommendations) {
  assert.ok(ids.has(countryId), `${name}: references unknown country ${countryId}`)
  assert.ok(!recommendationKeys.has(`${countryId}:${localeTag}`), `${countryId}: duplicate locale ${localeTag}`)
  recommendationKeys.add(`${countryId}:${localeTag}`)
  assert.equal(localeTag.split("-")[0].toLowerCase(), languageCode.toLowerCase(), `${name}: language code must match locale primary subtag`)
  if (localeTag.includes("Arab") || ["ar", "arz", "aec", "ur", "ps", "sd"].includes(languageCode)) assert.equal(direction, "rtl", `${name}: Arabic-script locale must be RTL`)
  assert.doesNotThrow(() => Intl.getCanonicalLocales(localeTag), `${name}: invalid BCP 47 tag ${localeTag}`)
  assert.ok(["official", "recognized", "indigenous", "regional", "community", "widely-used", "script-variant"].includes(category), `${name}: invalid category ${category}`)
  assert.equal(reviewStatus, "pending", `${name}: launch status must remain pending until human review`)
  perCountry.set(countryId, (perCountry.get(countryId) || 0) + 1)
}
for (const id of ids) assert.equal(perCountry.get(id), 4, `${id}: expected exactly four recommendations`)

assert.match(languageSource, /export function listCountryLanguages\(/)
assert.match(languageSource, /export function listGlobalLanguages\(/)
assert.match(languageSource, /export function listAvailableCountryLanguages\(/)
assert.match(indexSource, /country-languages/)
assert.match(catalogSource, /admin1Name\?\.trim\(\)/, "custom region name must survive structured location creation")
assert.match(pickerSource, /Enter \$\{country\.labels\.admin1\.toLowerCase\(\)\}/, "location picker must support countries without seeded admin1 data")
assert.match(pickerSource, /Enter \$\{country\.labels\.locality\.toLowerCase\(\)\}/, "location picker must support manual city/town entry")

const nigeria = recommendations.filter(([, countryId]) => countryId === "ng").map(([, , , , , name]) => name)
assert.deepEqual(nigeria, ["Hausa", "Igbo", "Yoruba", "Nigerian Pidgin"])

console.log("PASS canonical country catalog: all original 36 retained; 60 unique ISO2 countries, 10 per continent")
console.log("PASS timezone metadata: all 60 IANA timezone identifiers recognized")
console.log("PASS language matrix: 240 recommendations, exactly four per country")
console.log("PASS locale metadata: all 240 BCP 47 tags accepted by Intl")
console.log("PASS Nigerian pilot: Hausa, Igbo, Yoruba, Nigerian Pidgin")
console.log("PASS language API exports and unseeded-country location fallback")
console.log("Global language foundation: 6/6 checks PASS")
