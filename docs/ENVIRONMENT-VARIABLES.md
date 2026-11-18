# Environment variable policy

`.env.example` is the canonical variable inventory. Each variable must appear
exactly once. `NEXT_PUBLIC_*` variables are browser-visible and must never
contain secrets. All other variables are server-only unless code review proves
otherwise. Blank values are placeholders for deployment-specific credentials.
Do not invent URLs, client IDs, fee amounts, keys, passwords or private seeds.

Vercel Testnet deployment scope: Preview, Git branch `testnet`.
Keep Pi SDK Sandbox enabled and `PI_NETWORK=testnet`. Preserve enabled Testnet
feature gates; retain the Testnet-only backend/database fences. Keep Paystack
transfers disabled.
