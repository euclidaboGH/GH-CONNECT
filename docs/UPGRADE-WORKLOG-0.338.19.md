# GreenHaven upgrade worklog 0.338.19

- Repaired the three TypeScript blockers reported by GitHub Actions Run #241.
- Completed typed feed context parity for muted accounts and removed unsafe casts from feed privacy aggregation.
- Corrected duplicate design-token declaration by separating shell width from inner content width.
- Corrected BrandLogo shared prop ownership so the priority hint is not overridden by JSX props.
- Added 20 regression guardrails for logo loading/accessibility, feed privacy and persistence, design token uniqueness, loading accessibility and reduced-data behavior.
- Bumped application/package-lock metadata to 0.338.19.
- Dependency deprecation/native install warnings are documented for compatibility review; no risky transitive overrides or native-script approvals were introduced.
- No financial, payment, migration, Pi, production or deployment behavior was changed.


Source-level / source-only verification only. The supported runtime is Node.js 24.15.0; the available container runs Node.js 22.16.0 and does not contain the complete dependency tree. Full typecheck, lint and production build are therefore not claimed as passed.
