# Run #249 — dependency warning disposition

This review records the warnings from the 10 November 2026 CI/Vercel output. It intentionally does not perform blind major-version upgrades or approve native install scripts.

| Package / warning | Current evidence | Safe disposition |
|---|---|---|
| `isomorphic-dompurify@3.20.0` | Package marks 3.20.0 deprecated because its Node minimum changed without a major bump. Project runtime is Node 24.15.0. | No immediate runtime incompatibility established. Test a controlled 4.x migration against server/client sanitization and SSR before changing the major. |
| `eslint@9.39.5` | npm reports the installed version is no longer supported. | Keep the current Next 15-compatible major until ESLint 10 and the repository config/plugins are tested together. Upgrade as a separate compatibility task. |
| `pi-backend@0.1.3` → `stellar-sdk@10.4.1`, `stellar-base@8.2.2`, `js-xdr@1.3.0` | The deprecated Stellar packages are transitive dependencies of the Pi backend SDK. | Do not replace the Stellar dependency tree independently; first verify Pi SDK compatibility, transaction encoding, signing, and Testnet behavior. |
| `sodium-native@3.4.1` install script | Optional native package requests `node-gyp-build`; npm has not approved its install script. | Do not blanket-approve. Verify whether the Pi backend requires the native binding on supported deployment runtimes and whether its pure-JS fallback is complete. |
| `unrs-resolver@1.12.2` install script | Resolver package requests its postinstall script; npm has not approved it. | Keep script execution restricted until its exact consumer and platform-specific build impact are verified. |
| `actions/upload-artifact@v4` Node 20 warning | GitHub's Run #249 annotation identifies this action as the Node 20 warning source. | Updated the CI workflow to `actions/upload-artifact@v7`, whose current upstream metadata declares `runs.using: node24`. |

## Deferred work

- Run a dependency-tree and license/security review under Node 24.15.0 with a clean install.
- Validate the Pi backend and Stellar SDK replacement path on Pi Testnet before upgrading transitive provider libraries.
- Test DOMPurify and ESLint major upgrades in isolated branches before adopting them.
- Approve an individual install script only after confirming package ownership, source, platform behavior, and necessity.

No package dependency, lockfile resolution, native install-script permission, Pi transaction, or financial behavior was changed in this run.
