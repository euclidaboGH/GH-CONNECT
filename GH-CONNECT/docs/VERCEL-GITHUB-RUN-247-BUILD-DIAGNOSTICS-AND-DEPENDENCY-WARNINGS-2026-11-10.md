# Run #247 — Build failure diagnostics and dependency warning policy

Date: 2026-11-10  
Source baseline: `0.338.20` / Run #246  
CI commit supplied by the user: `569c1f3`

## What the supplied evidence establishes

The Run #247 excerpt confirms that the listed feed, error-boundary, membership rate-limit, timeout-code and related source checks passed before the production-build job exited with status 1. The visible `BUILD_UTILS_SPAWN_1` line is a wrapper-level failure, not the underlying compiler diagnostic. The supplied excerpt does not include the final Next.js compiler/build error, so the exact source-level build root cause is not established by this evidence.

The CI workflow pins Node.js `24.15.0`, matching `.nvmrc` and the package engine. The local review container only has Node.js `22.16.0`, and its npm registry requests failed with `EAI_AGAIN`; a dependency-backed reproduction is therefore unavailable here. A local failure caused by that unsupported runtime or incomplete dependency installation must not be reported as the Run #247 root cause.

## Run #247 improvements

1. Replaced the opaque one-line `prebuild` shell chain with a small diagnostic runner.
2. Preserved the complete existing prebuild command chain as `prebuild:checks`; no regression gate was intentionally removed.
3. Executes each check as a direct Node child process without a shell or `eval`.
4. Prints a numbered label before every prebuild check.
5. Reports the exact failing script, exit code or signal, and stops immediately.
6. Validates that every declared prebuild command is a direct Node invocation.
7. Checks that each prebuild command has a `scripts/*.mjs` target.
8. Checks that all referenced script targets exist before execution.
9. Enforces the package's Node engine range before running the build gates.
10. Adds `--list` / `--dry-run` output so the complete prebuild plan can be inspected without executing it.
11. Adds a focused 15-assertion source contract for the diagnostic runner and CI behavior.
12. Wires that focused contract into `verify:static` and exposes it as `npm run check:run247-build-diagnostics`.
13. Removes the obsolete user-level npm `cache-dir` setting before dependency installation, while retaining the project `.npmrc` and lockfile.
14. Records the npm version in both CI jobs so Node/npm toolchain drift is visible in the run log.
15. Uploads only Next.js `.next/trace` and `.next/diagnostics` artifacts for three days when the build job fails; no environment files, npm auth logs or application data are included.

## Dependency warning disposition

| Warning | Current decision | Reason |
|---|---|---|
| `isomorphic-dompurify@3.20.0` deprecated | Hold version pending Node 24.15.0 compatibility tests against a vetted 4.x release | The 4.x line is a major-version change and must be verified through server-side sanitization, client imports and production bundling before lockfile replacement. |
| `js-xdr`, `stellar-base`, `stellar-sdk` deprecated | Do not replace in isolation | They are transitive dependencies of `pi-backend@0.1.3`; replacing them independently risks changing Pi SDK transaction/XDR behavior. Plan a separately tested Pi backend adapter migration. |
| `eslint@9.39.5` EOL warning | Hold while the app remains on `eslint-config-next@15.5.26` | That config declares ESLint 7/8/9 peer support and does not declare ESLint 10. Upgrade Next.js and its lint stack together in a dedicated major-framework migration, not as a speculative build hotfix. |
| `sodium-native`, `unrs-resolver` install scripts | Do not blanket-approve | Both are transitive; `sodium-native` is optional and `unrs-resolver` is used by tooling. Approve only after exact package scripts, platform behavior and CI necessity are verified. |
| npm `cache-dir` | Remove user-level stale config in ephemeral CI | Project `.npmrc` remains unchanged; CI logs now record npm version. |

The dependency warnings are not, by themselves, proof of the Run #247 build failure. No dependency version, Pi SDK, React/Next major version, payment adapter or cryptographic package was changed in this run.

## Verification and limits

- Focused Run #247 diagnostic contract: expected 15 assertions.
- Prebuild command inventory: 277 existing commands retained from the baseline.
- The runner supports a dry-run listing without requiring dependencies.
- Node 24.15.0 dependency installation, full TypeScript check, ESLint and Next.js production build were not executable in this environment. The registry was unreachable and the available runtime was Node 22.16.0.
- The exact Run #247 Next.js compiler diagnostic still needs to be read from the failure artifact or complete GitHub build log. The diagnostic runner is intended to make any prebuild failure immediately attributable on the next CI run.

No Supabase migration was applied. No wallet balance, ledger, reservation, Pi payment, payout, escrow or membership entitlement was changed. No GitHub push, Vercel deployment or production configuration was changed. Production remains NOT APPROVED.
