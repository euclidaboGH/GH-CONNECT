# Settings section — overview, wiring & hardening 0.87.0

## Product model

Settings is the control plane for account, economy, privacy, safety, preferences, and support.

| Group | Destinations |
|-------|----------------|
| **Account & economy** | Wallet · Rewards · Invite · Membership |
| **Privacy & safety** | Privacy · Device lock (PIN) · Blocked users |
| **Preferences** | Notifications · Language/discovery · Appearance |
| **Support** | Help · About · Legal |
| **Session** | Log out (confirm) |

Deep-links: `ghc:open-settings` / `ghc:open-settings-section` with `wallet` | `rewards` | `membership` | `help`.

## Architecture

```
SettingsScreen
├── Nav stack + history (back one level)
├── Lazy: PremiumWalletScreen · RewardsCentre · Membership
├── Privacy, device-lock, notifications, appearance, preferences
├── Active sessions · passkeys · foundation status
└── Search over menu items
```

## Cross-feature wiring

| Feature | Settings link |
|---------|----------------|
| Profile | Open Settings / Wallet / Membership |
| Wallet | Full wallet module |
| Rewards + Referral | Rewards centre (invite row) |
| Membership | Full membership + server status subtitle |
| Notifications | Category toggles + browser permission |
| Messaging / Discover | Privacy who-can-message / location |
| Session security | Device lock PIN |

## Hardening in 0.87.0

1. **Membership subtitle** from `/api/membership/status` + `ghc:membership-activated`  
2. **Invite friends** menu row → Rewards (referral card)  
3. **Browser alerts** permission CTA on Notifications  
4. Permission helper fail-closed  

## Already solid (kept)

- Dual-level back stack · search  
- Privacy, blocked users, location privacy  
- Theme presets · offline-safe settings writes  
- Logout confirmation  

## Verify

1. Open Membership row shows VIP/Free from server  
2. Invite opens Rewards with referral card  
3. Enable browser alerts prompts permission  
4. Wallet / Rewards / Membership deep-links work  
5. Log out requires confirm  

Version **0.87.0**
