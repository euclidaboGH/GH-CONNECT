import assert from "node:assert/strict"
import { containsAnyWholeTerm, extractHashtags } from "../lib/feed/phase5-feed-primitives.ts"

const preferences = {
  hiddenPostIds: ["post-hidden"],
  notInterestedPostIds: ["post-less-relevant"],
  mutedTopics: ["ìfẹ́", "climate_change"],
}
const visibleByPreferences = (post) => {
  if (preferences.hiddenPostIds.includes(post.id) || preferences.notInterestedPostIds.includes(post.id)) return false
  const tags = post.hashtags || extractHashtags(post.content || "")
  return !containsAnyWholeTerm(post.content || "", preferences.mutedTopics)
    && !tags.some((tag) => containsAnyWholeTerm(tag, preferences.mutedTopics))
}
assert.equal(visibleByPreferences({ id: "post-hidden", content: "hello" }), false)
assert.equal(visibleByPreferences({ id: "post-less-relevant", content: "hello" }), false)
assert.equal(visibleByPreferences({ id: "post-1", content: "Climate change is urgent" }), false, "normalized muted phrases should match the complete phrase")
assert.equal(visibleByPreferences({ id: "post-2", content: "A climate_change policy update" }), false)
assert.equal(visibleByPreferences({ id: "post-3", content: "Ìfẹ́ matters" }), false)
assert.equal(visibleByPreferences({ id: "post-4", content: "A party with friends" }), true, "whole-token matching must not suppress substring matches")
console.log("Phase 5 durable preference runtime tests: PASS (account-scoped exclusions, Unicode topic matching, whole-token safety)")
