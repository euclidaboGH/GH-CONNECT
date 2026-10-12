# Section I implementation (2026-10-12)

## Observability / performance / a11y

| Item | Implementation |
|------|----------------|
| I48 Structured errors | Expanded `mapGhcUxError` + `lib/ux/map-api-error.ts` |
| I49 Web Vitals / CLS | Wallet balance min-height; feed/wallet skeletons; async image decode |
| I50 Accessibility | `prefers-reduced-motion` in globals; `useFocusTrap` on poll sheet; aria-live retained |

```bash
npm run test:observability-i
```
