# Source archive packaging note — hidden project metadata

The supplied `GREENHAVEN-0.338.87-FIELD-RESEARCH-FOUNDATION-2026-11-16.zip` does not contain `.github/workflows/ci.yml` or `.gitignore`. Several existing release-hygiene checks refer to those files and therefore cannot run from this archive alone. This increment does not fabricate replacements or infer the missing workflow policy.

When syncing this candidate into the existing GitHub Desktop working copy, preserve the existing `.github/` directory, `.gitignore`, and any other hidden repository metadata already present. Do not replace or delete them based solely on this archive. The source code and migration changes in this bundle do not authorize changing the repository's CI workflow.
