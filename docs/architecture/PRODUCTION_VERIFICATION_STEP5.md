> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Step 5 — production verification gates

The source tree includes static safety, JSX, dependency-lock and release-hygiene checks. These checks are necessary but do not prove a live deployment is healthy.

Before any Mainnet release, an authorized operator must separately verify:

- Vercel production deployment and Node.js runtime;
- correct Mainnet Pi configuration and server-only secrets;
- the expected Supabase project, applied migration inventory, RLS and RPC behavior;
- multi-user durable media, social, messaging, notifications and wallet flows;
- Pi payment lifecycle using approved test procedures;
- error handling and observability for unavailable database/storage services.

Never claim a migration is applied because its SQL file exists. Never claim a live Pi/Supabase integration is verified from static source checks alone. The repository status remains subject to operator evidence.
