# Vercel root layout (required)

This repository root MUST contain:

- package.json
- vercel.json
- next.config.mjs
- scripts/prepare-vercel-build.mjs
- app/
- components/

If GitHub shows `GH-CONNECT/package.json` nested one level down, Vercel will fail with:

`Cannot find module '/vercel/path0/scripts/prepare-vercel-build.mjs'`

**Fix:** push the *inner* project files to the repo root, or set Vercel Root Directory to `GH-CONNECT`.

Preferred: repo root = project root (no nesting).
