# UPGRADE-WORKLOG 0.338.61

## Summary
Vercel build resilience: buildCommand no longer hard-fails when scripts/prepare-vercel-build.mjs is absent on a partial tree. Doc hygiene classifies worklogs 0.338.57–0.338.61.

## Deploy note
Vercel **Root Directory** must be the repository root that contains `package.json`, `vercel.json`, and `scripts/`. Do not set Root Directory to a nested folder. Push the full project tree, not a partial docs-only commit.

## Source-only verification
Source-level only. Node.js 24.15.0. Production **NOT APPROVED**.
