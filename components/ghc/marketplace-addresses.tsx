"use client"

/**
 * Marketplace Phase 3 — "Delivery addresses" manager (buyer side, collapsed by default).
 * Talks only to /api/marketplace/addresses. It does not attach an address to any order and it
 * never stores addresses in the browser: if the server table is not available the panel says so.
 */
import { useCallback, useState } from "react"
import { buildSavePayload, formatAddressSummary, maskPhone, MAX_SAVED_ADDRESSES, parseSavedAddresses, type SavedAddress } from "@/lib/marketplace/saved-addresses"

type Load = "idle" | "loading" | "ready" | "unavailable" | "signin"
const EMPTY = { label: "Home", fullName: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "", phone: "" }
const MAX_LEN: Record<keyof typeof EMPTY, number> = { label: 40, fullName: 80, line1: 120, line2: 120, city: 60, region: 60, postalCode: 16, country: 56, phone: 24 }
const FIELDS: Array<[keyof typeof EMPTY, string, string]> = [
  ["label", "Label", "off"], ["fullName", "Full name", "name"], ["line1", "Address line 1", "address-line1"], ["line2", "Address line 2 (optional)", "address-line2"],
  ["city", "City", "address-level2"], ["region", "Region / state (optional)", "address-level1"], ["postalCode", "Postal code (optional)", "postal-code"],
  ["country", "Country (e.g. GH)", "country"], ["phone", "Phone", "tel"],
]

async function call(method: "GET" | "POST" | "DELETE", body?: Record<string, unknown>, query = ""): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(`/api/marketplace/addresses${query}`, {
      method, credentials: "include", cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> }
  } catch { return { status: 0, json: {} } }
}

export function MarketplaceAddressesPanel() {
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>("idle")
  const [items, setItems] = useState<SavedAddress[]>([])
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [makeDefault, setMakeDefault] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoad("loading")
    const { status, json } = await call("GET")
    if (status === 401) return setLoad("signin")
    if (status === 200 && json.ok === true) { setItems(parseSavedAddresses(json.addresses)); return setLoad("ready") }
    setLoad("unavailable")
  }, [])

  const toggle = () => { const next = !open; setOpen(next); if (next && load === "idle") void refresh() }

  const startEdit = (a: SavedAddress | null) => {
    setMessage(null); setEditId(a?.id ?? null); setMakeDefault(false)
    setForm(a ? { label: a.label, fullName: a.fullName, line1: a.line1, line2: a.line2, city: a.city, region: a.region, postalCode: a.postalCode, country: a.country, phone: a.phone } : { ...EMPTY })
  }

  const save = async () => {
    if (!form || busy) return
    const built = buildSavePayload(form, { id: editId, makeDefault })
    if (!built.ok) return setMessage("Check the highlighted details: name, address line, city, country and a valid phone number are required.")
    setBusy(true); setMessage(null)
    const { status, json } = await call("POST", { ...built.payload })
    setBusy(false)
    if (status === 200 && json.ok === true) { setForm(null); setEditId(null); return void refresh() }
    setMessage(json.error === "ADDRESS_LIMIT_REACHED" ? `You can save up to ${MAX_SAVED_ADDRESSES} addresses.` : status === 503 ? "Saved addresses aren't available yet." : "Couldn't save this address. Please try again.")
  }

  const makeDefaultFor = async (id: string) => {
    if (busy) return
    setBusy(true); setMessage(null)
    const { status, json } = await call("POST", { action: "set_default", id })
    setBusy(false)
    if (status === 200 && json.ok === true) return void refresh()
    setMessage("Couldn't change the default address.")
  }

  const remove = async (id: string) => {
    if (busy) return
    setBusy(true); setMessage(null)
    const { status, json } = await call("DELETE", undefined, `?id=${encodeURIComponent(id)}`)
    setBusy(false)
    if (status === 200 && json.ok === true) return void refresh()
    setMessage("Couldn't remove this address.")
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card" data-testid="marketplace-addresses">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between px-3 text-left text-[13px] font-bold text-foreground">
        <span>Delivery addresses</span>
        <span aria-hidden="true" className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/50 p-3" aria-live="polite">
          {load === "loading" ? <p className="text-[12px] text-muted-foreground">Loading…</p> : null}
          {load === "signin" ? <p className="text-[12px] text-muted-foreground">Sign in to manage saved addresses.</p> : null}
          {load === "unavailable" ? <p className="text-[12px] text-muted-foreground" data-testid="addresses-unavailable">Saved addresses aren&rsquo;t available yet. Nothing is stored on this device.</p> : null}
          {load === "ready" && !items.length && !form ? <p className="text-[12px] text-muted-foreground">No saved addresses yet.</p> : null}
          {load === "ready" ? (
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.id} className="rounded-xl border border-border/60 p-2 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">{a.label}{a.isDefault ? " · Default" : ""}</span>
                    <span className="text-muted-foreground">{maskPhone(a.phone)}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{a.fullName} — {formatAddressSummary(a)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <button type="button" disabled={busy} onClick={() => startEdit(a)}>Edit</button>
                    {!a.isDefault ? <button type="button" disabled={busy} onClick={() => void makeDefaultFor(a.id)}>Make default</button> : null}
                    <button type="button" disabled={busy} onClick={() => void remove(a.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {form ? (
            <div className="space-y-2 rounded-xl border border-border/60 p-2">
              {FIELDS.map(([key, label, auto]) => (
                <label key={key} className="block text-[11px] font-bold text-muted-foreground">
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    autoComplete={auto}
                    maxLength={MAX_LEN[key]}
                    className="mt-0.5 min-h-11 w-full rounded-lg border border-border/70 bg-background px-2 text-[13px] font-normal text-foreground"
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 text-[12px] text-foreground">
                <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
                Use as my default address
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => void save()} className="min-h-11 flex-1 rounded-xl bg-[var(--gh-green)] px-3 text-[13px] font-bold text-white">{busy ? "Saving…" : "Save address"}</button>
                <button type="button" disabled={busy} onClick={() => { setForm(null); setEditId(null); setMessage(null) }} className="min-h-11 rounded-xl border border-border/70 px-3 text-[13px] font-bold">Cancel</button>
              </div>
            </div>
          ) : load === "ready" && items.length < MAX_SAVED_ADDRESSES ? (
            <button type="button" onClick={() => startEdit(null)} className="min-h-11 rounded-xl border border-border/70 px-3 text-[13px] font-bold text-foreground">Add address</button>
          ) : null}
          {message ? <p className="text-[12px] font-semibold text-foreground" role="status">{message}</p> : null}
          <p className="text-[11px] text-muted-foreground">Addresses are private to your account. They are not yet attached to orders.</p>
        </div>
      ) : null}
    </section>
  )
}
