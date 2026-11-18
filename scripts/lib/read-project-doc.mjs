import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Read a project document from its canonical path or its preserved historical archive path. */
export function hasProjectDoc(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('docs/') || relativePath.includes('..')) return false
  return [
    relativePath,
    join('docs', 'archive', 'historical-implementation-records', basename(relativePath)),
    join('docs', 'archive', 'historical-implementation-records', `docs__${basename(relativePath)}`),
    join('docs', 'archive', 'historical-implementation-records', `docs__${relativePath.slice('docs/'.length).replaceAll('/', '__')}`),
    join('docs', 'archive', 'upgrade-worklogs', basename(relativePath)),
    join('docs', 'archive', 'phase-notes', basename(relativePath)),
  ].some((candidate) => existsSync(candidate))
}

export function readProjectDoc(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('docs/') || relativePath.includes('..')) {
    throw new TypeError(`Invalid project document path: ${String(relativePath)}`)
  }
  const candidates = [
    relativePath,
    join('docs', 'archive', 'historical-implementation-records', basename(relativePath)),
    join('docs', 'archive', 'historical-implementation-records', `docs__${basename(relativePath)}`),
    join('docs', 'archive', 'historical-implementation-records', `docs__${relativePath.slice('docs/'.length).replaceAll('/', '__')}`),
    join('docs', 'archive', 'upgrade-worklogs', basename(relativePath)),
    join('docs', 'archive', 'phase-notes', basename(relativePath)),
  ]
  const resolved = candidates.find((candidate) => existsSync(candidate))
  if (!resolved) {
    throw new Error(`Project document not found at canonical or historical path: ${relativePath}`)
  }
  return readFileSync(resolved, 'utf8')
}
