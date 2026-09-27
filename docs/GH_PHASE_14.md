# GreenHaven — Phase 14: Production Hardening (defined scope)

## Status

| Field | Value |
|-------|--------|
| Scope defined | **Yes — this document** |
| Product feature expansion | **No** |
| Financial / reward engines | **Out of scope** |
| Source implementation | Hardening + verification only |

Phase 14 is **not** “invent social ranking / GHC rewards / Phase 15.”  
It is the production-hardening layer that sits on top of Phases **1–13** source work.

---

## In scope

1. **Payment authorization regression (static)**  
   - Complete requires session auth  
   - Complete requires durable owned intent  
   - Incomplete recovery binds Pi payer identity  
   - Covered by `scripts/test-pi-payment-durable.mjs` section 6  

2. **Legacy / fabricated data hygiene**  
   - ChatScreen mock groups removed  
   - Misleading “mock” comments on discovery filters clarified  

3. **Release documentation honesty**  
   - Safe to push ≠ Mainnet ready  
   - Migration REQUIRED / REQUIRES_APPROVAL / PROPOSAL classification  

4. **Deferred surfaces remain fail-closed**  
   - See `docs/DEFERRED_AND_GATED.md`  

## Out of scope (do not implement under Phase 14)

| Item | Reason |
|------|--------|
| GHC-per-view / per-like rewards | Financial / abuse risk |
| Curation Power → money | Financial |
| Pi Ads reward mint | Needs provider verification product decision |
| Tip settlement | Needs payment settlement design |
| AI “For You” ranking | Product + infra decision |
| Blind apply of PROPOSAL migrations | Operator approval required |
| Phase 15 | Undefined |

---

## Operator gates (still required — not replaced by Phase 14 code)

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

Then Testnet: 51 REQUIRED migrations · IDOR · Pi Browser E2E · multi-instance.

---

## Future product phases (not Phase 14)

Any new product surface (e.g. Curation Power weights, creator payouts, ad rewards) requires a **new numbered phase** with an explicit approved specification and financial isolation review.
