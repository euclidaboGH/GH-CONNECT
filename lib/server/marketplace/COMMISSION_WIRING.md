# Commission wiring

Use `splitMarketplaceCommission` when marking an order completed/paid:

```ts
import { splitMarketplaceCommission } from "@/lib/server/marketplace/commission"

const split = splitMarketplaceCommission({
  grossAmount: order.totalAmount,
  currency: order.currency,
})
if ("error" in split) throw ...
// platformFeeMinor → company revenue journal (Pi/Paystack verified)
// sellerProceedsMinor → seller balance / payout eligibility
```

Record company share with `appendVerifiedCompanyRevenueEvent` only after payment verification.
