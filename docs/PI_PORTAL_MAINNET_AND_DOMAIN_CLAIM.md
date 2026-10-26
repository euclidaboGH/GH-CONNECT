# Pi Developer Portal — Mainnet listing & greenhaven.pi domain claim

**Domain:** greenhaven.pi (auction won; tentative claim needs qualifying app)  
**Claim window noted by Pi:** until **19 December 2026** to meet thresholds.

## Portal “App setup not completed” checklist

| Portal requirement | What you do | GreenHaven support |
|--------------------|-------------|--------------------|
| Hosting configured | Self-host on Vercel (or other); set production host | `NEXT_PUBLIC_APP_URL` |
| Connected app wallet | Create/connect in **Developer Portal** (Mainnet app) | Portal-only |
| Development URL | Preview/localhost URL in portal | Vercel Preview URL |
| Sandbox run | Testnet app + sandbox SDK | `NEXT_PUBLIC_PI_SANDBOX=true`, `PI_ENV=sandbox` |
| Developer guide opened | Open guide in portal checklist | Manual |
| Production URL + verified domain | Production URL + domain ownership file | `DOMAIN_VALIDATION_KEY` → `https://<domain>/validation-key.txt` |
| Privacy Policy URL | Absolute URL | `https://<domain>/privacy` |

### Domain verification
1. Copy the validation string from the Pi Developer Portal.  
2. Set Vercel env **`DOMAIN_VALIDATION_KEY`** (private) to that exact string.  
3. Confirm `https://your-domain/validation-key.txt` returns plain text.  
4. Click **Verify domain** in the portal.

### Separate apps
Register **two** portal apps: **Testnet** (sandbox) and **Mainnet** (production). Network cannot be changed after create. Use matching API keys per environment.

## greenhaven.pi claim thresholds
Connected app must:
1. Complete the setup checklist above  
2. Have **at least 5 unique KYC’d approved Pioneers** engage with the app  
3. Meet utility and compliance requirements  

**Honest limit:** GreenHaven sees **verified Pi sign-ins** (`gh_pi_identities`). It does **not** receive Pi KYC approval status. Grow real Pioneer usage; the portal measures KYC’d users on Pi’s side.

Track sign-in count via Settings → **Pi portal & greenhaven.pi readiness** or:

`GET /api/operator/pi-listing-readiness`  
(If `GHC_ADMIN_API_KEY` is set, send header `x-ghc-admin-key`.)

## Mainnet listing compliance (summary)
- Functional product, Pi Authentication only (no password login)  
- Developer KYC completed (you, in Pi KYC app)  
- No trademark misuse; domain must not start with `pi`  
- Prefer π for in-ecosystem commerce; GreenHaven uses **π-only fee rails** when `GHC_PI_ONLY_COMMERCE=1`  
- Minimal data collection; Privacy Policy URL set  
- Utility inside Pi Browser (social, communities, marketplace) — not a pure external funnel  

## Recommended Vercel env (Mainnet project)
| Variable | Visibility | Example |
|----------|------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public | `https://your-production-host` |
| `NEXT_PUBLIC_PI_SANDBOX` | Public | `false` |
| `PI_ENV` | Private | `production` |
| `PI_API_KEY` | Private | Mainnet server API key |
| `DOMAIN_VALIDATION_KEY` | Private | Portal validation string |
| `GHC_PI_ONLY_COMMERCE` | Private | `1` |
| `NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE` | Public | `1` |
| Supabase URL + service role | Private | Durable identity/sessions |

Privacy Policy URL to paste in portal: `https://<your-production-host>/privacy`
