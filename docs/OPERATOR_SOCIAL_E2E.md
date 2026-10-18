# Operator — multi-account social E2E

## Command

```bash
export GHC_E2E_BASE_URL="https://your-preview.vercel.app"
export GHC_E2E_COOKIE_A="…session cookie for user A…"
export GHC_E2E_COOKIE_B="…session cookie for user B…"
# Never commit cookies. Run only on a trusted machine.

npm run operator:live-e2e-social
```

## Stages covered

1. Distinct identities A ≠ B  
2. Forged actor binding on follow  
3. Connection request A→B (durable)  
4. Inbox B sees request  
5. IDOR accept blocked  
6. B accepts (durable)  
7. Follow A→B + B followers list  
8. Post create A + B feed visibility  
9. Like B + A feed count  
10. Comment B + A readback  
11. Reply A + B readback  
12. Comment emoji reaction  
13. Curation upvote  

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All stages PASS |
| 1 | One or more FAIL |
| 2 | Missing cookies / base URL |

Preview PASS ≠ Mainnet readiness.
