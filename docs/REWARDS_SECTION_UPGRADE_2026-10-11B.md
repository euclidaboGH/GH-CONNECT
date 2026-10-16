# Rewards upgrade (2026-10-11B)

## Five missing parts added

1. **Daily claim offline guard** + claiming state (journey hero)  
2. **Review pending claims** → History tab  
3. **Available GHC chip** from real `snapshot.wallet`  
4. **Escape** closes Learn more  
5. **Clearer missions empty** guidance (no fake missions)  

## Twenty maintenance areas

1–4 Offline/claim status (centre + hero)  
5–8 Tabs/a11y/counts (prior)  
9–12 Pending honesty + jump  
13–16 Wallet chip + open wallet  
17–20 Learn more Escape, empty copy, brand tokens, no fabricated economy  

## Safety

- Daily claim still `POST /api/economy/rewards/daily` only  
- Pending claim still `eco.claimReward` only  
- Balance display from domain wallet snapshot only  
