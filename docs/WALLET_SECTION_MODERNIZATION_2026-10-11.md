# Wallet — surgical modernization (2026-10-11)

## Twenty areas addressed

1. Escape closes pending / utility / receipt / payment-methods sheets  
2. Offline claim block + feedback  
3. Claim buttons disabled offline  
4. Claim-all disabled offline  
5. Main section tablist keyboard  
6. Tab roles + focus rings  
7. Asset rail brand token  
8. Claim-all brand border  
9. Activity transaction count (real filteredTxs)  
10. Pending sheet radius  
11. Claim feedback live region  
12. Existing offline balance banner retained  
13. GHC vs Pi rails retained  
14. Server claim path retained  
15. No fabricated balances  
16. Send/request offline guards retained  
17. Pending never spendable copy retained  
18. Wallet refresh events retained  
19. Primary actions composition retained  
20. Documented ledger boundary  

## Safety

- Balances from economy domain / server only  
- Claim via `/api/economy/rewards/claim` then domain  
- Offline never reports successful claim  
