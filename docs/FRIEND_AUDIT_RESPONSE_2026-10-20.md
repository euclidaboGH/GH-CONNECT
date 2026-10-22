> HISTORICAL SNAPSHOT — dated findings and test counts are not current release evidence. Check `docs/PROJECT_TRUTH.md` and the latest CI run.

---

# Response to external audit (2026-10-20)

Your friend's diagnosis matches the root cause we fixed in `GH-CONNECT-0.62.5-MEDIA-NOTIFY-CLAIM-2026-10-20`.

## Already implemented in our package (not the unfinished friend draft)

| Friend item | Status in this repo |
|-------------|---------------------|
| Show real upload error (not only "device only") | Toast includes `userMessage` + error code |
| Direct-to-storage for large files | `/api/media/direct-upload-intent` + `complete` + client `uploadViaDirect` |
| Higher limits | Images 25MB, video 40MB, files 25MB |
| Posts/stories use durable path | Compose rejects non-durable on publish |
| Pi-style daily claim popup | `DailyClaimPrompt` mounted in `app.tsx` |
| Daily claimed notification | `notifyRewardClaimed` on successful claim |
| Notification wording for votes/comments | Bell type mapping for upvote/downvote/reply |
| `/api/media/health` diagnostics | Added this pass |
| DM/chat media as durable | **Not done** — API still text-first; `sendMediaMessage` is local-only by design until messaging schema supports attachments |

## Do not apply the friend's unfinished working copy

They stated it was incomplete and would not build (`useRef` issue in *their* copy). Our `daily-reward-experience.tsx` does not use `useRef`.

## What you should still send them / check

1. Open while signed in: `https://connect-5p3o.vercel.app/api/media/health`
2. Open while signed in: `https://connect-5p3o.vercel.app/api/auth/session`
3. After deploy of **this** zip, retry photo upload and check Vercel logs for `/api/media` or `/api/media/direct-upload-intent`

## Next separate phase (recommended)

Durable DM/comment media: messaging API schema + RLS + UI attachers — do not fake durable delivery.
