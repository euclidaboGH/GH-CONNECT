#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const root=process.cwd(), dir=join(root,'supabase','migrations')
const files=readdirSync(dir).filter(n=>n.endsWith('.sql')).sort(), errors=[], versions=new Map()
for(const file of files){const m=file.match(/^(\d{14})_/);if(!m)errors.push(`invalid 14-digit migration version: ${file}`);if(m){if(versions.has(m[1]))errors.push(`duplicate migration version ${m[1]}`);versions.set(m[1],file)}if(statSync(join(dir,file)).size===0)errors.push(`empty migration: ${file}`)}
if(files.length===0) errors.push('no canonical migrations found')
const manifestPath=join(root,'VERIFIED_MANIFEST.txt')
if(!existsSync(manifestPath)) errors.push('VERIFIED_MANIFEST.txt missing')
if(!existsSync(join(root,'MIGRATION-SOURCE-MANIFEST.csv'))) errors.push('MIGRATION-SOURCE-MANIFEST.csv missing')
if(errors.length){console.error(errors.map(e=>`FAIL ${e}`).join('\n'));process.exit(1)}
console.log(`PASS clean canonical migrations: ${files.length} unique 14-digit SQL migrations`)
