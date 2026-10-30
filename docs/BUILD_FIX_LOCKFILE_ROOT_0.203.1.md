# Build fix — lockfile at repository root (0.203.1)

## Failure
Vercel/CI: `npm ci` requires `package-lock.json` at the project root. Nested `src/` ZIP layout left the lockfile one directory down when the repo root was used as the install directory.

## Fix
- Ship a **flat** tree: `package.json` + `package-lock.json` at root
- Ensure `.gitignore` does not exclude `package-lock.json`
- Version synchronized to 0.203.1

## Deploy note
Push the flat tree so the GitHub root contains `package-lock.json`. Vercel Root Directory should be empty / `.` (not `src`).
