# GreenHaven 0.120.0

## Polls
- Composer creates durable poll via POST /api/social/polls first, then feed post with pollId marker
- Offline gate before publish
- PollInline on feed cards: vote via API, ALREADY_VOTED handling, results after vote
- Content parser recovers polls from 📊 POLL posts when post.poll is absent

## Prior
0.109–0.119 global-test hardening retained
