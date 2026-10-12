# Dependency audit cadence

1. Every PR / CI — `npm ci --legacy-peer-deps` only.
2. Weekly operator — `npm audit --production`.
3. Security patches — minimal bumps; re-run `npm run ci:verify`.
4. Major upgrades — explicit ticket; never with economy/auth changes.
5. Never commit `.env` or `node_modules`.
