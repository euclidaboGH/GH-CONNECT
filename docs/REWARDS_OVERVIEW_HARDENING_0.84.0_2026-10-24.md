# Rewards section — overview, wiring & hardening 0.84.0

## Product model

| Path | Authority |
|------|-----------|
| **Daily claim** | Server ledger only (Lagos day key, cycle day, idempotent) |
| **Pending holds** | Often 48h maturity before spendable claim |
| **Missions / challenges** | UI progress only until server verifies action once |
| **Activity rules** | Domain rules; validation before credit |
| **Curation fund** | Separate spendable pool when policy allows |
| **Referral** | Attribute + queue; settlement flag-gated |

Never client-mint GHC. Fail-closed when verification is unavailable.

## Architecture

```
RewardsCentreScreen
├── Server economy strip (available / pending / locked / curation)
├── RewardsJourneyHero (XP · streak · daily claim CTA · countdown)
├── EconomyProgramStatus (operator flags honesty)
├── ReferralShareCard
├── Quality streak (verified contribution days)
├── Tabs: Missions · Earn · History · Achievements
└── Pending claim stack → economy.claimReward

APIs
├── GET/POST /api/economy/rewards/daily
├── POST /api/economy/rewards/claim
├── POST /api/economy/missions/progress  (fail-closed without verification)
└── /api/social/economy/status
```

## Cross-feature wiring

| Feature | Link |
|---------|------|
| Wallet | syncWalletAfterServerClaim · ghc:wallet-synced / refresh |
| Notifications | notifyRewardClaimed · rewards bucket |
| Referral | Share card on Rewards surface |
| Feed / social | Quality streak inputs; content rewards panels |
| Membership | Tier affects daily cycle amounts |
| Curation | Status strip fundable flag |

## Hardening in 0.84.0

1. Daily claim success → **notifyRewardClaimed** + wallet-synced/refresh events  
2. **ReferralShareCard** on Rewards centre  
3. **Missions honesty banner** (no device mint; verification required)  
4. Centre **live refresh** on daily-claim / wallet-synced / wallet-refresh  

## Env

| Variable | Privacy |
|----------|---------|
| `GHC_ACTIVITY_REWARDS_ENABLED` | Private |
| `GHC_CURATION_REDISTRIBUTE_ENABLED` | Private |
| `GHC_TESTNET_UNLOCK` | Private |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | Private |

## Verify

1. Claim daily → toast + notification + wallet balance path updates  
2. Second claim same day → already claimed  
3. Missions tab shows verification honesty  
4. Referral card loads code on Rewards  
5. Pending copy mentions 48h lock  

Version **0.84.0**
