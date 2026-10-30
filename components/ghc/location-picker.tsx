"use client"

/**
 * Reusable structured location picker.
 * Country → Admin1 → Admin2 (when available) → Locality → optional area.
 * Labels come from country metadata — never forces Nigeria terminology globally.
 */

import { useMemo, useState } from "react"
import {
  listContinents,
  listCountries,
  getCountry,
  listAdmin1,
  listAdmin2,
  listLocalities,
  buildStructuredLocation,
  type StructuredLocation,
  type LocationPrivacyLevel,
} from "@/lib/geography"

type Props = {
  value?: StructuredLocation | null
  onChange: (loc: StructuredLocation | null) => void
  privacy?: LocationPrivacyLevel
  onPrivacyChange?: (p: LocationPrivacyLevel) => void
  /** Dark onboarding style */
  variant?: "dark" | "light"
  requireLocality?: boolean
  showPrivacy?: boolean
  idPrefix?: string
}

export function LocationPicker({
  value,
  onChange,
  privacy = "locality",
  onPrivacyChange,
  variant = "light",
  requireLocality = true,
  showPrivacy = false,
  idPrefix = "loc",
}: Props) {
  const [continent, setContinent] = useState<string>("")
  const countryId = value?.countryId || ""
  const admin1Id = value?.admin1Id || ""
  const admin2Id = value?.admin2Id || ""
  const localityId = value?.localityId || ""
  const [area, setArea] = useState(value?.sublocalityName || "")

  const countries = useMemo(
    () => (continent ? listCountries(continent as any) : listCountries()),
    [continent]
  )
  const country = countryId ? getCountry(countryId) : undefined
  const admin1List = countryId ? listAdmin1(countryId) : []
  const admin2List = admin1Id ? listAdmin2(admin1Id) : []
  const localityList = admin1Id ? listLocalities(admin1Id, admin2Id || undefined) : []

  const field =
    variant === "dark"
      ? "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/40 [color-scheme:dark]"
      : "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"

  const labelCls =
    variant === "dark"
      ? "mb-1.5 block text-[12px] font-bold text-white/60"
      : "mb-1.5 block text-xs font-semibold text-stone-600"

  const emit = (partial: {
    countryId?: string
    admin1Id?: string
    admin2Id?: string
    localityId?: string
    localityName?: string
    sublocalityName?: string
  }) => {
    const cid = partial.countryId ?? countryId
    if (!cid) {
      onChange(null)
      return
    }
    const loc = buildStructuredLocation({
      countryId: cid,
      admin1Id: partial.admin1Id !== undefined ? partial.admin1Id || undefined : admin1Id || undefined,
      admin2Id: partial.admin2Id !== undefined ? partial.admin2Id || undefined : admin2Id || undefined,
      localityId: partial.localityId !== undefined ? partial.localityId || undefined : localityId || undefined,
      localityName: partial.localityName,
      sublocalityName: partial.sublocalityName ?? area,
    })
    onChange(loc)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-continent`}>
          Continent
        </label>
        <select
          id={`${idPrefix}-continent`}
          className={field}
          value={continent}
          onChange={(e) => {
            setContinent(e.target.value)
            onChange(null)
          }}
        >
          <option value="">All continents</option>
          {listContinents().map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-country`}>
          Country *
        </label>
        <select
          id={`${idPrefix}-country`}
          className={field}
          value={countryId}
          onChange={(e) => {
            const id = e.target.value
            if (!id) onChange(null)
            else emit({ countryId: id, admin1Id: "", admin2Id: "", localityId: "" })
          }}
        >
          <option value="">Select country</option>
          {(continent ? countries : listCountries()).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {country && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-admin1`}>
              {country.labels.admin1} *
            </label>
            <select
              id={`${idPrefix}-admin1`}
              className={field}
              value={admin1Id}
              disabled={!countryId}
              onChange={(e) =>
                emit({
                  countryId,
                  admin1Id: e.target.value,
                  admin2Id: "",
                  localityId: "",
                })
              }
            >
              <option value="">Select</option>
              {admin1List.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {admin2List.length > 0 && (
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-admin2`}>
                {country.labels.admin2}
              </label>
              <select
                id={`${idPrefix}-admin2`}
                className={field}
                value={admin2Id}
                disabled={!admin1Id}
                onChange={(e) =>
                  emit({
                    countryId,
                    admin1Id,
                    admin2Id: e.target.value,
                    localityId: "",
                  })
                }
              >
                <option value="">{admin2List.length ? "Select LGA / district" : "Optional"}</option>
                {admin2List.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="custom-lga">My LGA is not listed…</option>
              </select>
              <p className={variant === "dark" ? "mt-1 text-[10px] text-white/40" : "mt-1 text-[10px] text-stone-400"}>
                All listed areas can be selected. If yours is missing, pick any nearby LGA and type your exact town below.
              </p>
            </div>
          )}

          <div className={admin2List.length > 0 ? "sm:col-span-2" : ""}>
            <label className={labelCls} htmlFor={`${idPrefix}-locality`}>
              {country.labels.locality}
              {requireLocality ? " *" : ""}
            </label>
            <select
              id={`${idPrefix}-locality`}
              className={field}
              value={localityId === "custom" ? "custom" : localityId}
              disabled={!admin1Id}
              onChange={(e) => {
                const id = e.target.value
                if (id === "custom") {
                  emit({
                    countryId,
                    admin1Id,
                    admin2Id,
                    localityId: "custom",
                    localityName: value?.localityName && localityId === "custom" ? value.localityName : "",
                  })
                  return
                }
                const name = localityList.find((l) => l.id === id)?.name
                emit({
                  countryId,
                  admin1Id,
                  admin2Id,
                  localityId: id,
                  localityName: name,
                })
              }}
            >
              <option value="">Select</option>
              {localityList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="custom">My city / town is not listed…</option>
            </select>
            {(localityId === "custom" || (!localityId && requireLocality && admin1Id)) && (
              <input
                className={`${field} mt-2`}
                placeholder="Type your city or town"
                value={localityId === "custom" ? (value?.localityName || "") : ""}
                onChange={(e) => {
                  const name = e.target.value
                  emit({
                    countryId,
                    admin1Id,
                    admin2Id,
                    localityId: "custom",
                    localityName: name,
                  })
                }}
                aria-label="Custom city or town"
              />
            )}
          </div>

          {country.labels.sublocality && (
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor={`${idPrefix}-area`}>
                {country.labels.sublocality} (optional)
              </label>
              <input
                id={`${idPrefix}-area`}
                className={field}
                value={area}
                placeholder="e.g. ward or neighborhood"
                onChange={(e) => {
                  setArea(e.target.value)
                  emit({
                    countryId,
                    admin1Id,
                    admin2Id,
                    localityId,
                    localityName: value?.localityName,
                    sublocalityName: e.target.value,
                  })
                }}
              />
            </div>
          )}
        </div>
      )}

      {showPrivacy && onPrivacyChange && (
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-privacy`}>
            Who can see my location
          </label>
          <select
            id={`${idPrefix}-privacy`}
            className={field}
            value={privacy}
            onChange={(e) => onPrivacyChange(e.target.value as LocationPrivacyLevel)}
          >
            <option value="hidden">Hidden</option>
            <option value="country">Country only</option>
            <option value="admin1">{country?.labels.admin1 || "Region"} + country</option>
            <option value="admin2">District level</option>
            <option value="locality">City / town</option>
          </select>
          <p className={`mt-1 text-[11px] ${variant === "dark" ? "text-white/40" : "text-stone-500"}`}>
            Precise coordinates are never shared without explicit consent.
          </p>
        </div>
      )}
    </div>
  )
}
