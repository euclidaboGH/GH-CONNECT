/** Dedicated PI earnings A2U worker. Testnet-only; never shared with seller/cashback payout domains. */
import { randomUUID, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { assertPayoutWalletAuthorization } from "@/lib/server/identity/wallet-authorization"
import { resolvePiSandbox } from "@/lib/pi-env"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import type { PiBackendPayment } from "pi-backend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status=200) { return NextResponse.json(body,{status,headers}) }
function secretOk(request: Request) {
  const expected=Buffer.from(String(process.env.PI_EARNINGS_EXECUTOR_KEY||process.env.GHC_A2U_ADMIN_KEY||""),"utf8")
  const supplied=Buffer.from(String(request.headers.get("x-ghc-pi-earnings-key")||request.headers.get("x-ghc-a2u-admin-key")||""),"utf8")
  return expected.length>=16 && expected.length===supplied.length && timingSafeEqual(expected,supplied)
}
function amountMatches(a: unknown,b:number) { const n=typeof a==="number"?a:Number(a); return Number.isFinite(n)&&Math.abs(n-b)<1e-8 }
function matches(p: PiBackendPayment,input:{id:string;requestId:string;uid:string;amount:number}) {
  return p.identifier===input.id && p.direction==="app_to_user" && p.network==="Pi Testnet" &&
    p.user_uid===input.uid && amountMatches(p.amount,input.amount) &&
    String(p.metadata?.direction||"")==="a2u" && String(p.metadata?.payoutRequestId||"")===input.requestId &&
    p.status?.cancelled!==true && p.status?.user_cancelled!==true
}
async function rest<T>(base:string,key:string,path:string,init:RequestInit={}):Promise<T> {
  const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,...(init.headers||{})},cache:"no-store",signal:AbortSignal.timeout(15_000)})
  const data=await r.json().catch(()=>null)
  if(!r.ok) throw new Error(`SUPABASE_HTTP_${r.status}`)
  return data as T
}
async function rpc<T>(base:string,key:string,name:string,body:Record<string,unknown>):Promise<T> {
  return rest<T>(base,key,`rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
}
export async function POST(request:Request) {
  const auth=await resolveAuthenticatedUser(request.headers)
  if(!auth) return reply({ok:false,error:"AUTH_REQUIRED"},401)
  if(!secretOk(request)) return reply({ok:false,error:"FORBIDDEN"},403)
  const rl=checkRateLimit(`pi-earnings-execute:${auth.userId}`,2,60_000)
  if(!rl.ok) return reply({ok:false,error:"RATE_LIMITED"},429)
  if(process.env.PI_EARNINGS_PAYOUT_EXECUTION_ENABLED!=="true" || process.env.PI_A2U_ENABLED!=="true" || process.env.PI_A2U_TESTNET_ONLY!=="true" || process.env.PI_NETWORK!=="testnet" || process.env.PI_ENV!=="production" || !resolvePiSandbox()) return reply({ok:false,error:"PI_EARNINGS_EXECUTION_DISABLED"},503)
  const apiKey=String(process.env.PI_API_KEY||process.env.PI_SERVER_API_KEY||"").trim()
  const seed=String(process.env.PI_WALLET_PRIVATE_SEED||"").trim()
  if(!apiKey||!/^S[A-Z2-7]{55}$/.test(seed)) return reply({ok:false,error:"PI_SERVER_CREDENTIALS_MISSING"},503)
  const parsed=await readBoundedJson(request,8*1024)
  if(!parsed.ok) return reply({ok:false,error:parsed.error},parsed.error==="REQUEST_TOO_LARGE"?413:400)
  const body=parsed.value as {requestId?:unknown}
  const requestId=String(body?.requestId||"").trim()
  if(!/^[0-9a-f-]{36}$/i.test(requestId)) return reply({ok:false,error:"INVALID_REQUEST_ID"},400)
  const env=readGhcServerEnv(); if(!env.supabaseUrl||!env.supabaseServiceRoleKey) return reply({ok:false,error:"PAYOUT_SERVICE_UNAVAILABLE"},503)
  const base=env.supabaseUrl.replace(/\/$/,""); const key=env.supabaseServiceRoleKey
  const rows=await rest<Array<{id:string;user_id:string;gross_atomic:string;fee_atomic:string;net_atomic:string;recipient_pi_app_uid:string;network:string;status:string;provider_payment_id:string|null}>>(base,key,`gh_pi_earnings_payout_requests?${new URLSearchParams({id:`eq.${requestId}`,user_id:`eq.${auth.userId}`,select:"id,user_id,gross_atomic,fee_atomic,net_atomic,recipient_pi_app_uid,network,status,provider_payment_id",limit:"1"})}`)
  const row=rows[0]; if(!row) return reply({ok:false,error:"REQUEST_NOT_FOUND"},404)
  if(row.status==="paid") return reply({ok:true,duplicate:true,status:"paid",requestId})
  if(row.status==="released"||row.status==="failed") return reply({ok:false,error:"REQUEST_TERMINAL"},409)
  if(row.network!=="Pi Testnet") return reply({ok:false,error:"TESTNET_ONLY"},409)
  const wallet=await assertPayoutWalletAuthorization({ghUserId:auth.userId,recipientUid:row.recipient_pi_app_uid})
  if(!wallet.ok) return reply({ok:false,error:wallet.error||"WALLET_AUTHORIZATION_REQUIRED"},wallet.error==="WALLET_AUTHORIZATION_UNAVAILABLE"?503:409)
  const lease=randomUUID()
  const begin=await rpc<{ok:boolean;error?:string;providerPaymentId?:string|null;recipientUid:string;netPi:number;status?:string;duplicate?:boolean}>(base,key,"gh_pi_earnings_payout_begin_execution",{p_request_id:requestId,p_user_id:auth.userId,p_lease_token:lease}).catch(()=>null)
  if(!begin?.ok) return reply({ok:false,error:begin?.error||"EXECUTION_CLAIM_FAILED",retryable:begin?.error==="EXECUTION_BUSY"},begin?.error==="EXECUTION_BUSY"?409:503)
  if(begin.duplicate&&begin.status==="paid") return reply({ok:true,duplicate:true,status:"paid",requestId})
  let uncertain=true
  let heartbeatLost=false
  let heartbeatBusy=false
  const heartbeatTimer=setInterval(()=>{
    if(heartbeatBusy) return
    heartbeatBusy=true
    void rpc<{ok:boolean}>(base,key,"gh_pi_earnings_payout_heartbeat_execution",{p_request_id:requestId,p_lease_token:lease})
      .then(result=>{if(!result?.ok) heartbeatLost=true})
      .catch(()=>{heartbeatLost=true})
      .finally(()=>{heartbeatBusy=false})
  },45_000)
  heartbeatTimer.unref?.()
  try {
    const mod=await import("pi-backend"); const sdk=new mod.default(apiKey,seed)
    if(heartbeatLost) throw new Error("EXECUTION_LEASE_HEARTBEAT_LOST")
    let paymentId=String(begin.providerPaymentId||"")
    if(!paymentId) {
      const incomplete=await sdk.getIncompleteServerPayments()
      const match=incomplete.find(p=>p.direction==="app_to_user"&&p.network==="Pi Testnet"&&p.user_uid===begin.recipientUid&&amountMatches(p.amount,begin.netPi)&&String(p.metadata?.direction||"")==="a2u"&&String(p.metadata?.payoutRequestId||"")===requestId)
      if(match?.identifier) paymentId=match.identifier
      else if(incomplete.length) return reply({ok:false,error:"UNRELATED_INCOMPLETE_A2U_REQUIRES_OPERATOR_REVIEW",retryable:false},409)
      else {
        // Revalidate ownership immediately before creating a provider-side payment.
        const active=await rpc<{ok:boolean}>(base,key,"gh_pi_earnings_payout_heartbeat_execution",{p_request_id:requestId,p_lease_token:lease})
        if(!active?.ok||heartbeatLost) throw new Error("EXECUTION_LEASE_LOST_BEFORE_CREATE")
        paymentId=await sdk.createPayment({amount:begin.netPi,memo:`GreenHaven PI earnings withdrawal ${requestId}`.slice(0,120),metadata:{provider:"greenhaven",direction:"a2u",payoutRequestId:requestId,domain:"pi_earnings"},uid:begin.recipientUid})
      }
      const bind=await rpc<{ok:boolean;error?:string}>(base,key,"gh_pi_earnings_payout_bind_provider_payment",{p_request_id:requestId,p_lease_token:lease,p_provider_payment_id:paymentId})
      if(!bind.ok) throw new Error(bind.error||"PROVIDER_BIND_FAILED")
    }
    let payment=await sdk.getPayment(paymentId)
    const exactBinding=payment.identifier===paymentId&&payment.direction==="app_to_user"&&payment.network==="Pi Testnet"&&payment.user_uid===begin.recipientUid&&amountMatches(payment.amount,begin.netPi)&&String(payment.metadata?.direction||"")==="a2u"&&String(payment.metadata?.payoutRequestId||"")===requestId
    if(!exactBinding) throw new Error("PROVIDER_PAYMENT_BINDING_MISMATCH")
    const paymentTxid=String(payment.transaction?.txid||"")
    if((payment.status?.cancelled===true||payment.status?.user_cancelled===true)&&!paymentTxid) {
      const released=await rpc<{ok:boolean;error?:string}>(base,key,"gh_pi_earnings_payout_release_verified_failure",{
        p_request_id:requestId,p_provider_payment_id:paymentId,p_network:"Pi Testnet",
        p_cancelled:payment.status?.cancelled===true,p_user_cancelled:payment.status?.user_cancelled===true,
        p_has_transaction:false,p_failure_code:"PI_PROVIDER_CONFIRMED_CANCELLED",p_receipt:{identifier:payment.identifier,direction:payment.direction,network:payment.network,user_uid:payment.user_uid,amount:payment.amount,status:payment.status,transaction:payment.transaction,metadata:payment.metadata},
      })
      if(!released.ok) throw new Error(released.error||"AUTHORITATIVE_RELEASE_FAILED")
      uncertain=false
      return reply({ok:true,requestId,status:"released",reservationReleased:true,providerPaymentId:paymentId},200)
    }
    if(!matches(payment,{id:paymentId,requestId,uid:begin.recipientUid,amount:begin.netPi})) throw new Error("PROVIDER_PAYMENT_BINDING_MISMATCH")
    let txid=paymentTxid
    if(txid && payment.status?.transaction_verified!==true && payment.transaction?.verified!==true) throw new Error("EXISTING_TRANSACTION_UNVERIFIED")
    if(!txid) {
      const active=await rpc<{ok:boolean}>(base,key,"gh_pi_earnings_payout_heartbeat_execution",{p_request_id:requestId,p_lease_token:lease})
      if(!active?.ok||heartbeatLost) throw new Error("EXECUTION_LEASE_LOST_BEFORE_SUBMIT")
      txid=await sdk.submitPayment(paymentId)
    }
    if(!txid) throw new Error("PROVIDER_TXID_MISSING")
    if(heartbeatLost) throw new Error("EXECUTION_LEASE_HEARTBEAT_LOST")
    if(payment.status?.developer_completed!==true) {
      const active=await rpc<{ok:boolean}>(base,key,"gh_pi_earnings_payout_heartbeat_execution",{p_request_id:requestId,p_lease_token:lease})
      if(!active?.ok||heartbeatLost) throw new Error("EXECUTION_LEASE_LOST_BEFORE_COMPLETE")
      const completed=await sdk.completePayment(paymentId,txid)
      if(!matches(completed,{id:paymentId,requestId,uid:begin.recipientUid,amount:begin.netPi})||completed.status?.developer_completed!==true) throw new Error("PROVIDER_COMPLETION_UNCONFIRMED")
    }
    // Independent read-after-write from Pi is mandatory; never settle from the mutation response alone.
    const receipt=await sdk.getPayment(paymentId)
    if(heartbeatLost) throw new Error("EXECUTION_LEASE_HEARTBEAT_LOST")
    if(!matches(receipt,{id:paymentId,requestId,uid:begin.recipientUid,amount:begin.netPi})||receipt.transaction?.txid!==txid||receipt.status?.transaction_verified!==true&&receipt.transaction?.verified!==true||receipt.status?.developer_completed!==true) throw new Error("INDEPENDENT_PROVIDER_RECEIPT_MISMATCH")
    const active=await rpc<{ok:boolean}>(base,key,"gh_pi_earnings_payout_heartbeat_execution",{p_request_id:requestId,p_lease_token:lease})
    if(!active?.ok||heartbeatLost) throw new Error("EXECUTION_LEASE_LOST_BEFORE_SETTLEMENT")
    const settled=await rpc<{ok:boolean;error?:string;status?:string}>(base,key,"gh_pi_earnings_payout_settle_verified",{
      p_request_id:requestId,p_provider_payment_id:paymentId,p_provider_txid:txid,p_recipient_uid:begin.recipientUid,
      p_amount_pi:begin.netPi,p_network:"Pi Testnet",p_transaction_verified:true,p_developer_completed:true,
      p_receipt:{identifier:receipt.identifier,direction:receipt.direction,network:receipt.network,user_uid:receipt.user_uid,amount:receipt.amount,transaction:receipt.transaction,status:receipt.status,metadata:receipt.metadata},
    })
    if(!settled.ok) throw new Error(settled.error||"LEDGER_SETTLEMENT_FAILED")
    uncertain=false
    return reply({ok:true,requestId,status:"paid",network:"Pi Testnet",providerPaymentId:paymentId,txid,grossAtomic:row.gross_atomic,feeAtomic:row.fee_atomic,netAtomic:row.net_atomic})
  } catch(error) {
    return reply({ok:false,error:"PI_EARNINGS_EXECUTION_UNCERTAIN",detail:error instanceof Error?error.message.slice(0,160):"unknown",retryable:true,reservationRetained:true,requestId},503)
  } finally {
    clearInterval(heartbeatTimer)
    await rpc(base,key,"gh_pi_earnings_payout_end_execution",{p_request_id:requestId,p_lease_token:lease,p_uncertain:uncertain,p_failure_code:"PI_PROVIDER_OUTCOME_UNCERTAIN"}).catch(()=>null)
  }
}
