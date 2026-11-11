#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, readFileSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = resolve(fileURLToPath(new URL("./prepare-vercel-build.mjs", import.meta.url)))
const temp = mkdtempSync(join(tmpdir(), "greenhaven-run272-build-prep-"))
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}
try {
  const cache = join(temp, ".next", "cache", "webpack")
  mkdirSync(cache, { recursive: true })
  writeFileSync(join(cache, "oversized-pack.pack"), "synthetic-cache")
  const clean = spawnSync(process.execPath, [script], { cwd: temp, encoding: "utf8" })
  assert(clean.status === 0, "normal stale Webpack cache cleanup succeeds")
  assert(!existsSync(cache), "only the stale Webpack cache directory is removed")

  const outside = join(temp, "outside")
  mkdirSync(outside)
  writeFileSync(join(outside, "preserve.txt"), "preserve")
  mkdirSync(join(temp, ".next", "cache"), { recursive: true })
  symlinkSync(outside, cache, "dir")
  const blocked = spawnSync(process.execPath, [script], { cwd: temp, encoding: "utf8" })
  assert(blocked.status !== 0, "symlinked Webpack cache cleanup is refused")
  assert(readFileSync(join(outside, "preserve.txt"), "utf8") === "preserve", "symlink target remains untouched")

  // Build caches can legitimately be regenerated inside the Vercel build
  // workspace. They must be ignored/excluded, not mistaken for source files.
  const fixture = join(temp, "phase26-cache-policy")
  const sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
  const requiredFiles = [
    "package.json", "package-lock.json", ".gitignore", ".vercelignore", "tsconfig.json",
    "contexts/domains/wallet-read-provider.tsx", "lib/domains/wallet-v2.ts",
    "components/ghc/unified-earnings-dashboard.tsx", "features/wallet/wallet-balance.tsx",
    "features/wallet/wallet-screen.tsx", "docs/CURRENT_BUILD_CONTEXT.md",
    "MIGRATION-SOURCE-MANIFEST.csv", "VERIFIED_MANIFEST.txt", ".env.example",
    "scripts/check-phase26-wallet-ledger-resilience.mjs",
  ]
  for (const file of requiredFiles) {
    const destination = join(fixture, file)
    mkdirSync(join(destination, ".."), { recursive: true })
    cpSync(join(sourceRoot, file), destination)
  }
  const gitInit = spawnSync("git", ["init", "-q"], { cwd: fixture, encoding: "utf8" })
  assert(gitInit.status === 0, "incremental-cache fixture initializes a Git worktree")
  spawnSync("git", ["config", "user.email", "test@example.invalid"], { cwd: fixture })
  spawnSync("git", ["config", "user.name", "GreenHaven test"], { cwd: fixture })
  spawnSync("git", ["add", "."], { cwd: fixture })
  spawnSync("git", ["commit", "-qm", "fixture baseline"], { cwd: fixture })
  mkdirSync(join(fixture, ".cache"), { recursive: true })
  mkdirSync(join(fixture, ".next", "cache", "typescript"), { recursive: true })
  writeFileSync(join(fixture, ".cache", "tsconfig.tsbuildinfo"), "{}")
  writeFileSync(join(fixture, ".next", "cache", "typescript", "tsconfig.tsbuildinfo"), "{}")
  writeFileSync(join(fixture, "tsconfig.tsbuildinfo"), "{}")
  const cacheCheck = spawnSync(process.execPath, [join(fixture, "scripts/check-phase26-wallet-ledger-resilience.mjs")], { cwd: fixture, encoding: "utf8" })
  assert(cacheCheck.status === 0, "regenerated ignored TypeScript build caches do not fail the wallet release gate")
  assert(cacheCheck.stdout.includes("incremental build cache is excluded from source releases"), "source-release cache policy is checked")

  mkdirSync(join(fixture, "src"), { recursive: true })
  writeFileSync(join(fixture, "src", "tracked.tsbuildinfo"), "{}");
  spawnSync("git", ["add", "-f", "src/tracked.tsbuildinfo"], { cwd: fixture })
  const trackedCacheCheck = spawnSync(process.execPath, [join(fixture, "scripts/check-phase26-wallet-ledger-resilience.mjs")], { cwd: fixture, encoding: "utf8" })
  assert(trackedCacheCheck.status !== 0, "tracked TypeScript build caches remain a hard failure")

  // Exercise source-release/Vercel environments without .git metadata. Known
  // generated cache locations are allowed, while stray cache artifacts in
  // source roots are rejected instead of being silently accepted.
  const noGitFixture = join(temp, "phase26-cache-policy-no-git")
  for (const file of requiredFiles) {
    const destination = join(noGitFixture, file)
    mkdirSync(join(destination, ".."), { recursive: true })
    cpSync(join(sourceRoot, file), destination)
  }
  mkdirSync(join(noGitFixture, ".cache"), { recursive: true })
  writeFileSync(join(noGitFixture, ".cache", "tsconfig.tsbuildinfo"), "{}")
  const noGitGenerated = spawnSync(process.execPath, [join(noGitFixture, "scripts/check-phase26-wallet-ledger-resilience.mjs")], { cwd: noGitFixture, encoding: "utf8" })
  assert(noGitGenerated.status === 0, "generated build caches in a no-Git Vercel workspace are accepted")
  writeFileSync(join(noGitFixture, "tsconfig.tsbuildinfo"), "{}")
  const noGitStray = spawnSync(process.execPath, [join(noGitFixture, "scripts/check-phase26-wallet-ledger-resilience.mjs")], { cwd: noGitFixture, encoding: "utf8" })
  assert(noGitStray.status !== 0, "stray source-root build caches fail without Git metadata")

  console.log("Run 272 Vercel build-prep tests: 10/10 passed")
} finally {
  rmSync(temp, { recursive: true, force: true })
}
