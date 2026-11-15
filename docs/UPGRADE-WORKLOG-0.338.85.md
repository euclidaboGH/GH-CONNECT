# UPGRADE-WORKLOG 0.338.85

## Blocking fix
Release hygiene required **exactly two** occurrences of:
`process.versions.node !== '24.15.0'`
in `.github/workflows/ci.yml` (one in the static job, one in the build job).

Added an explicit “Assert exact Node 24.15.0 runtime” step to both jobs after `setup-node`.

## Verification
- Release hygiene **17/17**
- Phase 10 release closure **16/16**
- Run #300 **20/20**

## Retained
0.338.84 feed / home / profile / community / post-card density improvements.

Production remains **NOT APPROVED**.
