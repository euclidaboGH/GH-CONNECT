# Source archive packaging note — hidden project metadata

The authoritative 0.338.92 archive omits `.github/workflows/ci.yml` and `.gitignore`. Inspection of the actual GitHub repository found the existing CI workflow on the default branch but not on `testnet`; both branch and default-branch Contents API lookups confirmed that the root `.gitignore` is absent.

The 0.338.92 Vercel/GitHub remediation candidate restores the exact existing default-branch CI workflow into `.github/workflows/ci.yml` on the candidate tree and adds a conservative root `.gitignore`. The CI workflow retains read-only contents permission, Node 24.15.0, dependency-lock validation before clean install, static/RLS/SECURITY DEFINER checks, typecheck, lint, safety scan and build. It does not apply database migrations or deploy Vercel production.

The changes are local candidate files only. No GitHub push or Vercel deployment has been performed. Preserve other hidden repository metadata and do not replace unrelated workflow files when syncing the candidate.
