"use client"

import { useCallback, useState } from "react"

type Qualification = {
  requiredCount?: number
  qualifiedCount?: number
  qualified?: boolean
  network?: string
  note?: string
  recipients?: Array<{ ghUserId: string; piAppUid: string; kycStatus: string; kycEvidenceRef: string; kycVerifiedAt: string; verifiedBy: string }>
  transactions?: Array<{ providerPaymentId: string; txid: string; piAppUid: string; amount: number; network: string; direction: string; verifiedAt: string; verifiedBy: string }>
}

export default function A2uQualificationPage() {
  const [key, setKey] = useState("")
  const [operator, setOperator] = useState("")
  const [ghUserId, setGhUserId] = useState("")
  const [piAppUid, setPiAppUid] = useState("")
  const [evidenceRef, setEvidenceRef] = useState("")
  const [kycConfirmed, setKycConfirmed] = useState(false)
  const [paymentId, setPaymentId] = useState("")
  const [txid, setTxid] = useState("")
  const [data, setData] = useState<Qualification | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const call = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    const response = await fetch("/api/admin/a2u-qualification", {
      method,
      headers: { "Content-Type": "application/json", "x-ghc-a2u-admin-key": key },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok !== true) throw new Error(String(payload.error || `REQUEST_FAILED_${response.status}`))
    return payload
  }, [key])

  const refresh = async () => {
    setBusy(true); setError(""); setMessage("")
    try { const result = await call("GET"); setData(result); setMessage("Qualification register refreshed.") }
    catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED") }
    finally { setBusy(false) }
  }

  const attest = async () => {
    setBusy(true); setError(""); setMessage("")
    try {
      await call("POST", { action: "attest_recipient", ghUserId, piAppUid, kycEvidenceRef: evidenceRef, kycFullyPassed: kycConfirmed, operator })
      setMessage("Fully KYC-passed Pioneer attestation saved. This is an operator attestation, not an automatic Pi KYC API result.")
      setGhUserId(""); setPiAppUid(""); setEvidenceRef(""); setKycConfirmed(false); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "ATTESTATION_FAILED") }
    finally { setBusy(false) }
  }

  const record = async () => {
    setBusy(true); setError(""); setMessage("")
    try {
      const result = await call("POST", { action: "record_verified_payment", providerPaymentId: paymentId, txid, piAppUid, operator })
      setMessage(`Provider settlement verified and recorded. Qualification count: ${result.qualification?.qualifiedCount ?? "updated"}/5.`)
      setPaymentId(""); setTxid(""); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "PAYMENT_VERIFICATION_FAILED") }
    finally { setBusy(false) }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-12">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pi ecosystem readiness · Run 261</p>
      <h1 className="text-2xl font-bold">A2U qualification register</h1>
      <p className="max-w-3xl text-sm text-slate-600">Track five genuine Pi Testnet App-to-User settlements to five distinct Pioneers whose full KYC-passed status has been checked by an authorized operator.</p>
    </header>
    <section className="rounded-xl border p-4">
      <h2 className="font-semibold">Operator access</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">A2U admin key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Server-configured operator key" /></label>
        <label className="text-sm">Operator identifier<input value={operator} onChange={e=>setOperator(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Your operator ID" /></label>
      </div>
      <button disabled={busy || key.length<32 || operator.trim().length<2} onClick={refresh} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : "Load qualification register"}</button>
      {message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
    {data && <>
      <section className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Verified A2U progress</h2><p className="text-xs text-slate-500">Pi Testnet only · distinct KYC-attested recipients</p></div><strong className="text-2xl tabular-nums">{data.qualifiedCount ?? 0}/{data.requiredCount ?? 5}</strong></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{width:`${Math.min(100,((data.qualifiedCount||0)/5)*100)}%`}} /></div>
        <p className="mt-2 text-sm">{data.qualified ? "Five qualifying transactions are recorded. This is technical evidence, not a guarantee of Pi Core Team listing approval." : `${Math.max(0,5-(data.qualifiedCount||0))} more distinct, fully verified Pioneer A2U settlement(s) required.`}</p>
        <p className="mt-2 text-xs text-amber-700">{data.note}</p>
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">1. Attest a fully KYC-passed Pioneer</h2>
        <p className="mt-1 text-xs text-slate-500">Check the Pioneer directly in the official Pi KYC app. Do not accept tentative approval. Store only a non-sensitive evidence reference; never upload ID documents or KYC screenshots here.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">GreenHaven user ID<input value={ghUserId} onChange={e=>setGhUserId(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Pi app-specific UID<input value={piAppUid} onChange={e=>setPiAppUid(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm sm:col-span-2">Non-sensitive KYC evidence reference<input value={evidenceRef} onChange={e=>setEvidenceRef(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Internal review reference (no personal data)" /></label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={kycConfirmed} onChange={e=>setKycConfirmed(e.target.checked)} className="mt-1" />I personally verified this Pioneer shows **KYC passed / fully approved** in the official Pi KYC app. This is not tentative approval.</label>
        <button disabled={busy || !key || operator.trim().length<2 || ghUserId.trim().length<8 || piAppUid.trim().length<3 || evidenceRef.trim().length<4 || !kycConfirmed} onClick={attest} className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40">Save KYC attestation</button>
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">2. Verify and record a completed A2U payment</h2>
        <p className="mt-1 text-xs text-slate-500">This only reads Pi's existing payment record. It does not create, submit, complete, retry, or cancel a payment.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Provider payment ID<input value={paymentId} onChange={e=>setPaymentId(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Verified blockchain transaction ID<input value={txid} onChange={e=>setTxid(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm sm:col-span-2">Recipient Pi app-specific UID<input value={piAppUid} onChange={e=>setPiAppUid(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        </div>
        <button disabled={busy || !key || operator.trim().length<2 || paymentId.trim().length<1 || txid.trim().length<8 || piAppUid.trim().length<3} onClick={record} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Verify provider record and count transaction</button>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4"><h2 className="font-semibold">KYC-attested recipients ({data.recipients?.length||0})</h2><div className="mt-3 space-y-2">{(data.recipients||[]).map(r=><article key={r.piAppUid} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{r.piAppUid}</strong><p>{r.kycStatus} · {r.verifiedBy}</p><p className="text-slate-500">Evidence ref: {r.kycEvidenceRef}</p></article>)}</div></div>
        <div className="rounded-xl border p-4"><h2 className="font-semibold">Qualifying A2U settlements ({data.transactions?.length||0})</h2><div className="mt-3 space-y-2">{(data.transactions||[]).map(t=><article key={t.providerPaymentId} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{t.amount} π · {t.piAppUid}</strong><p>Provider: {t.providerPaymentId}</p><p className="break-all">Tx: {t.txid}</p><p className="text-slate-500">{t.network} · {t.direction} · {t.verifiedBy}</p></article>)}</div></div>
      </section>
    </>}
    <footer className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Qualification records are Testnet-only and operator-restricted. Five recorded settlements do not imply automatic ecosystem listing. Mainnet A2U remains disabled until Pi Core Team approves the outgoing wallet and the Mainnet environment is separately reviewed.</footer>
  </main>
}
