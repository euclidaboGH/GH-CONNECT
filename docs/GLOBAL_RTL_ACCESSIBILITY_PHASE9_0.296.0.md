# Phase 9 — Global RTL and Accessibility Foundation (0.296.0)

## Scope

This phase strengthens the existing locale-direction foundation without introducing a visual redesign or changing domain behaviour. The document root remains driven by the canonical locale resolver. The skip-to-content link now follows the selected preview language. Logical CSS utilities support inline-start/end spacing, borders and text alignment. Directional icon mirroring is opt-in to avoid incorrectly flipping logos, media controls or other non-directional artwork.

Mixed-script numeric values in notification counts are isolated with an LTR `bdi` span so digits remain legible inside RTL interfaces. Contrast preference and Windows forced-colors modes receive stronger focus and border treatments. Readable-copy and long-value helpers support zoom/reflow without clipping.

## Translation and safety boundary

Catalog version 6 invalidates prior review approvals until native-speaker and product-owner review is repeated. Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial preview packs. User-generated content is not translated. Wallet balances, currency codes, transaction identifiers, payment states and financial calculations remain unchanged.

## Verification

The dedicated RTL/accessibility regression check is part of `prebuild` and `verify:static`. Source checks do not prove runtime screen-reader behavior, browser-specific bidi rendering, a Node 24 production build or live deployment behavior.
