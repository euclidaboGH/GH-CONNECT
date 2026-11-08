# UPGRADE WORKLOG 0.338.6

## Lint / a11y / hooks hardening
- app/error.tsx: Next.js Link for Home/Support/Privacy (no-html-link-for-pages)
- brand-logo: explicit alt on img (static jsx-a11y)
- Removed unused @next/next/no-img-element eslint-disable directives
- Hook deps: filterPrefs / browseFilters / historyFilters object deps; discovery useMemo without profileIntents; message openThread without selectedId; transaction receipt includes correlationReferences
- Tabs: aria-selected only (drop aria-pressed on role=tab)

## Verification boundary
This release uses source-only verification (source-level static gates and isolated helper tests).
Supported build runtime: Node.js 24.15.0

Production remains NOT APPROVED.
