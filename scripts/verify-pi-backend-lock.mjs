#!/usr/bin/env node
/**
 * Fail-closed verification for the official Pi backend SDK lock entry.
 * This does not create or edit the lockfile; npm must generate registry metadata.
 */
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const readJson = (name) => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const errors = [];
const pass = (condition, message) => condition || errors.push(message);
const dependencyVersion = pkg.dependencies?.['pi-backend'];
const entry = lock.packages?.['node_modules/pi-backend'];

pass(dependencyVersion === '0.1.3', `package.json must pin official pi-backend@0.1.3 (found ${dependencyVersion ?? 'missing'})`);
pass(lock.packages?.['']?.dependencies?.['pi-backend'] === '0.1.3', 'lockfile root must declare pi-backend@0.1.3');
pass(Boolean(entry), 'lockfile must contain node_modules/pi-backend');
if (entry) {
  pass(entry.version === '0.1.3', `locked Pi SDK version must be 0.1.3 (found ${entry.version ?? 'missing'})`);
  pass(typeof entry.resolved === 'string' && /^https:\/\/registry\.npmjs\.org\/pi-backend\/-\/pi-backend-0\.1\.3\.tgz$/.test(entry.resolved), 'Pi SDK must resolve from the official npm registry tarball');
  pass(typeof entry.integrity === 'string' && /^sha(?:512|1)-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity), 'Pi SDK must have registry-generated integrity metadata');
  for (const name of ['axios', 'stellar-sdk']) {
    pass(Boolean(entry.dependencies?.[name]), `Pi SDK lock metadata must declare ${name}`);
    const child = lock.packages?.[`node_modules/${name}`];
    pass(Boolean(child), `lockfile must include transitive dependency node_modules/${name}`);
    if (child) {
      pass(typeof child.version === 'string' && child.version.length > 0, `${name} must have a locked version`);
      pass(typeof child.resolved === 'string' && child.resolved.startsWith('https://registry.npmjs.org/'), `${name} must resolve from the official npm registry`);
      pass(typeof child.integrity === 'string' && /^sha(?:512|1)-[A-Za-z0-9+/]+={0,2}$/.test(child.integrity), `${name} must have registry-generated integrity metadata`);
    }
  }
}

if (errors.length) {
  console.error(`Pi backend lock verification failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  console.error('Regenerate package-lock.json with npm on a registry-connected supported Node runtime; do not hand-author resolved or integrity values.');
  process.exit(1);
}
console.log('Pi backend lock verification passed: official version, registry tarball, integrity, axios, and stellar-sdk are present.');
