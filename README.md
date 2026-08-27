# GH Connect

Pi-powered social, matching, community, messaging, marketplace and GHC utility platform.

## Deploy on Vercel (new project)

1. Create a **new empty** GitHub repository (do not nest inside another folder).
2. Upload **all files from this zip to the repository root** (so `package.json` is at the top level).
3. Import the repo in Vercel → **New Project**.
4. Settings:
   - **Root Directory**: leave **empty** (project root)
   - **Framework Preset**: Next.js
   - **Install Command**: `npm install --legacy-peer-deps`
   - **Build Command**: `next build`
5. Deploy.

## Pi domain validation

After deploy, open:

`https://YOUR-VERCEL-DOMAIN/validation-key.txt`

You should see only the raw validation key (plain text). Then verify the domain in the Pi Developer Portal.

## Local development

```bash
npm install --legacy-peer-deps
npm run dev
```
