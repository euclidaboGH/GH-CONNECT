import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync(new URL('../.github/workflows/repair-npm-lock.yml', import.meta.url), 'utf8');
const verifier = fs.readFileSync(new URL('./verify-pi-backend-lock.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(workflow, /workflow_dispatch:/, 'repair must be explicitly operator-triggered');
assert.match(workflow, /contents: write[\s\S]*pull-requests: write/, 'workflow must declare the minimal permissions needed to open a PR');
assert.match(workflow, /node-version: "24\.15\.0"/, 'workflow must use the supported Node runtime');
assert.match(workflow, /npm view pi-backend@0\.1\.3/, 'workflow must query the official registry metadata');
assert.match(workflow, /npm install --package-lock-only --legacy-peer-deps/, 'workflow must use npm to regenerate the lockfile');
assert.match(workflow, /node scripts\/verify-pi-backend-lock\.mjs/, 'workflow must verify the SDK lock graph');
assert.match(workflow, /npm ci --legacy-peer-deps/, 'workflow must prove a clean install');
assert.match(workflow, /npm run ci:verify/, 'workflow must run full project verification and build');
assert.match(workflow, /add-paths: package-lock\.json/, 'automated PR must contain only package-lock.json');
assert.doesNotMatch(workflow, /vercel deploy|supabase db push|npm publish/i, 'repair workflow must not deploy, mutate database, or publish packages');
assert.match(verifier, /registry\.npmjs\.org/, 'verifier must require official npm registry resolution');
assert.match(verifier, /integrity/, 'verifier must require integrity metadata');
assert.match(verifier, /stellar-sdk/, 'verifier must verify Pi SDK transitive dependency');
assert.equal(pkg.dependencies?.['pi-backend'], '0.1.3', 'official Pi SDK dependency must remain pinned');
assert.equal(pkg.scripts?.['check:pi-backend-lock'], 'node scripts/verify-pi-backend-lock.mjs');
console.log('Pi backend lock repair workflow tests: 15/15 passed.');
