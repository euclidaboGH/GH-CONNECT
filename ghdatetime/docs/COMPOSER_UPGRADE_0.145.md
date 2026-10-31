# Unified compose 0.145.0

## Behavior
- Body scroll lock while open
- Offline detection banner
- beforeunload when dirty
- Discard confirm on close when dirty
- Ctrl/⌘+Enter to publish
- Publish lock + upload-in-progress block
- Max 10 photos enforced (guard + slice)
- Autosave last-saved time
- Durable media only publish (existing)

## Features improved
- Character counter with near-limit warning
- Photo count N/10 + clear all
- Paste images from clipboard
- Textarea resize + max height
- Challenge + poll entry from toolbar
- Footer keyboard hint
- Draft saved timestamp

## Limits module
`lib/composer/compose-limits.ts` — single source for text/media caps.
