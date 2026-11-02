import fs from 'node:fs'

const story = fs.readFileSync(new URL('../components/ghc/profile-story-section.tsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20261101170001_gh_story_match_audience_support.sql', import.meta.url), 'utf8')
const checks = [
  ['matches-only is a selectable story audience', /id: "matches-only", title: "Matches"/.test(story)],
  ['match visibility uses canonical matched-user IDs only', /const matchSet = new Set\(matches\.map/.test(story) && /item\.userId \|\| item\.matchedUserId/.test(story) && !/item\.userId \|\| item\.matchedUserId \|\| item\.id/.test(story)],
  ['matches-only stories require a match', /story\.audience === "matches-only"\) return matchSet\.has\(String\(story\.ownerId\)\)/.test(story)],
  ['followers-only stories require an actual follow', /story\.audience === "followers"\) return followingSet\.has\(String\(story\.ownerId\)\)/.test(story)],
  ['friends-only stories remain restricted to friends', /story\.audience === "friends"\) return friendSet\.has\(String\(story\.ownerId\)\)/.test(story)],
  ['private stories are excluded from the feed', /story\.audience === "private"\) return false/.test(story)],
  ['own story opens through canonical view handler', /ownStory \? openStory\(ownStory\) : openCreator\(\)/.test(story)],
  ['other stories open through canonical view handler', /onClick=\{\(\) => openStory\(item\)\}/.test(story)],
  ['view handler records local seen state and requests server view', /const openStory = \(story: StoryItem\) => \{[\s\S]*?socialViewStory\(String\(story\.id\)\)/.test(story)],
  ['seen stories have a distinct visual state', /seenStoryIds\.includes\(item\.id\)[\s\S]{0,100}border-border bg-muted/.test(story)],
  ['story rail uses modern portrait touch targets', /w-\[100px\]/.test(story) && /h-\[124px\] w-\[100px\]/.test(story)],
  ['video advances when playback ends', /onEnded=\{\(\) => navigateStory\(1\)\}/.test(story)],
  ['story audience labels are human-readable', /STORY_AUDIENCES\.find\(\(item\) => item\.id === viewing\.audience\)\?\.title/.test(story)],
  ['reactions require durable server confirmation', /!result\.ok \|\| result\.durable === false/.test(story)],
  ['local-only story publication is not reported as live', /result\.durable === false/.test(story)],
  ['story list RPC supports reciprocal durable matches', /gh_story_list_active[\s\S]*?s\.audience = 'matches-only'[\s\S]*?viewer_signal\.signal IN \('like', 'superlike'\)[\s\S]*?owner_signal\.signal IN \('like', 'superlike'\)/.test(migration)],
  ['story view RPC enforces block denial before audience grants', /gh_story_view[\s\S]*?IF EXISTS \([\s\S]*?ghc_user_blocks[\s\S]*?RETURN jsonb_build_object\('ok', false, 'error', 'NOT_AVAILABLE'\)[\s\S]*?IF v_owner = p_viewer_id OR v_audience = 'everyone'/.test(migration)],
  ['story view and reaction RPCs both enforce reciprocal match access', (migration.match(/s\.audience = 'matches-only'/g) || []).length >= 1 && (migration.match(/ELSIF v_audience = 'matches-only'/g) || []).length === 2],
  ['story RPC execution remains service-role only', /REVOKE ALL ON FUNCTION public\.gh_story_list_active\(text\) FROM PUBLIC[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_story_list_active\(text\) TO service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_story_view\(text, text\) TO service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_story_reaction_toggle\(text, text, text\) TO service_role/.test(migration)],
  ['local story preferences validate JSON array shapes', /const parsed: unknown = JSON\.parse\(raw\)[\s\S]*?Array\.isArray\(parsed\)/.test(story)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Phase 3 story experience integrity: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
