# RUN335 — Election tally type narrowing repair (2026-11-18)

## Why this follow-up exists

The RUN334 source archive still used overloaded nullable type-predicate signatures in the election tally API. The user-provided Vercel log continued to report `number > {}` at the ballot/accreditation comparison. RUN335 replaces that fragile overload pattern rather than asserting a type or suppressing the compiler.

## Source correction

- Optional JSON counts are normalized by `optionalCount(value: unknown): number | null | undefined`. Missing and explicit `null` become `null`; valid safe non-negative bounded integers become numbers; all other values become `undefined` and are rejected by the request validation gate.
- Required counts and candidate vote counts use one `isCount(value: unknown): value is number` type guard.
- Numeric comparisons execute only after the invalid sentinel has been rejected, leaving the optional values narrowed to `number | null`.
- Existing maximum count, safe integer, candidate sum, registered/accredited voter and valid/rejected/total ballot checks are retained.
- The React Hook dependency corrections from RUN334 are retained.

## Verification

- RUN335 source regression gate: 8/8 passed.
- Strict TypeScript 5.8.3 fixture for the exact JSON normalization and comparisons: passed.
- `npm run verify:static`: passed.
- `npm run prebuild`: did not run because the environment has Node 22.16.0 and the project requires Node `^24.15.0`.
- No complete dependency-backed Next.js production build, GitHub push, Vercel deployment, Supabase migration, or Mainnet operation occurred.

Production remains NOT APPROVED pending supported-runtime build and release gates.
