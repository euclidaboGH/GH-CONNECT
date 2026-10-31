# 0.148.0 — Media download tools + performance

## Media tools
- `lib/media/download-media.ts`: resolve facade → signed URL, download via blob/share/anchor
- MediaLightbox: Download + Share buttons; long-press tools sheet; context menu
- Feed post card: long-press photo → View full screen / Download photo
- Post detail sheet: hold photo to download
- DM / message attachments: hold or Download control
- Group message image/file attachments: wired download

## Performance / UX
- Feed content-visibility + contain-intrinsic-size on post cards
- Idle prefetch of signed URLs for visible feed media
- `scheduleIdle` + `prefetchMediaFacades` in mobile-performance
- Section fade motion (respects prefers-reduced-motion)
- Overscroll contain on feed scroll

## Carry-forward from 0.147.0
- Full-screen media lightbox (gallery + video)
- Post-media neutral tile (no PI initials)
- Non-owner curation vote path
