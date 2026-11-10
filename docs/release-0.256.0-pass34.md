> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.256.0 — Pass 34

## Personal command centre and priority clarity

Pass 34 reorganizes the existing Home cross-feature recommendations into four readable priority groups: Respond, Participate, Build your presence, and Review and manage. The highest-priority recommendation remains singular and prominent; remaining existing signals are grouped beneath it to reduce scanning effort and make the next useful action easier to find.

The grouping layer consumes only the already-derived HomeCrossFeatureSignal records. It does not create activity, infer completion, change recommendation evidence, persist user behavior, or mutate financial state. Group actions continue to call the existing destination handler.

Canonical navigation remains Home · Messages · Communities · Cart · Profile. Wallet remains an overlay. No Supabase migrations are changed.
