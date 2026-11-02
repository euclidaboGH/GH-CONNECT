import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'scripts/check-roadmap-phase9-navigation-resilience.mjs',
  'scripts/check-roadmap-phase9-continuation3.mjs',
  'scripts/check-roadmap-phase9-continuation4.mjs',
  'scripts/check-roadmap-phase9-continuation5.mjs',
  'scripts/check-roadmap-phase9-continuation6.mjs',
  'scripts/check-roadmap-phase9-continuation7.mjs',
  'scripts/check-roadmap-phase9-continuation8.mjs',
  'scripts/test-phase9-resilience-runtime.mjs',
  'app/error.tsx', 'app/global-error.tsx', 'app/not-found.tsx', 'app/loading.tsx',
  'docs/ROADMAP-PHASE-9-CLOSURE-AND-PHASE-10-HANDOFF-2026-11-02.md',
];
let failed = 0;
for (const file of required) {
  const ok = fs.existsSync(path.join(root, file));
  console.log(`${ok ? 'PASS' : 'FAIL'} Phase 9 closure artifact exists: ${file}`);
  if (!ok) failed++;
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['prebuild', 'verify:static']) {
  const value = pkg.scripts?.[script] ?? '';
  const ok = value.includes('check-roadmap-phase9-closure.mjs') && value.includes('check-roadmap-phase10-release-evidence.mjs');
  console.log(`${ok ? 'PASS' : 'FAIL'} ${script} includes Phase 9 closure and Phase 10 release evidence checks`);
  if (!ok) failed++;
}
const doc = fs.readFileSync(path.join(root, 'docs/ROADMAP-PHASE-9-CLOSURE-AND-PHASE-10-HANDOFF-2026-11-02.md'), 'utf8');
for (const phrase of ['Playwright', 'not yet executed', '24.15.0', 'not production approval']) {
  const ok = doc.toLowerCase().includes(phrase.toLowerCase());
  console.log(`${ok ? 'PASS' : 'FAIL'} Closure note states verification boundary: ${phrase}`);
  if (!ok) failed++;
}
console.log(`Phase 9 closure source checks: ${required.length + 6 - failed}/${required.length + 6} passed`);
if (failed) process.exitCode = 1;
