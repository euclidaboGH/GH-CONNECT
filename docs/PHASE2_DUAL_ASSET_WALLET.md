> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 2 — Professional dual-asset wallet

## Goal
One professional wallet surface for **PI earnings** and **GHC utility** with shared actions and never-mixed rails.

## UX contract
1. **Balance card** — selectable PI and GHC rows; fail-closed PI snapshot; month metrics footer.
2. **Shared actions** — Withdraw/Send · Status/Request · Linked/Receive · History (labels follow selected rail).
3. **Secondary panels** — when PI selected: full PI earnings + cashback; when GHC selected: collapsed PI tools.
4. **Advanced** — payment recovery + sandbox status remain collapsed.
5. **Activity** — GHC | PI segmented history; rails never mixed in one list.

## Files
- `features/wallet/wallet-balance.tsx`
- `features/wallet/wallet-actions.tsx`
- `features/wallet/wallet-screen.tsx`

## Acceptance
- [ ] One combined balance card (not three competing PI heroes)
- [ ] Action row works on light card theme
- [ ] PI selection expands earnings tools; GHC keeps them collapsed
- [ ] History tabs remain asset-separated
- [ ] `check:unified-wallet-card` passes

## Limits
Does not enable A2U or invent balances. Withdraw still requires Phase 4 operator flags.
