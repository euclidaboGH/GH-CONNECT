# Upgrade Worklog — 0.338.108

Release identity: `gh-connect@0.338.108`.

- Repaired Vercel source packaging so `.env.example` is not removed by a broad `.env*` ignore pattern.
- Retained explicit exclusions for local secret environment files.
- Added actionable missing-template failure handling to RUN376.
- Updated Vercel-ignore source contracts and release hygiene checks.
- Expanded CSP for the exact Pi SDKLite script CDNs and configured Pi plugin backend origin; added RUN371 regression checks.
- Audited Pi auth flow without changing identity, payment, wallet, or database authority.
- Package/lockfile/app release version synchronized at `0.338.108`.
- Live Pi Browser and deployment verification remain operator gates.
