import fs from "node:fs"

const card = fs.readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
const stories = fs.readFileSync("components/ghc/profile-story-section.tsx", "utf8")
const checks = []
const check = (name, ok) => { checks.push({ name, ok: Boolean(ok) }); console.log(`  ${ok ? "✓" : "✗"} ${name}`) }

console.log("\n=== FEED CARD LAYOUT & COMMENT DISCLOSURE ===\n")
check("post cards no longer render inline comment bodies", !card.includes("post.comments.slice(-2)") && !card.includes("comment.text}</span></button>"))
check("comment count opens the dedicated comments surface", card.includes("aria-label={`View ${visibleCommentCount.toLocaleString()} comments`}") && card.includes("onComment(post.id)"))
check("one post options trigger remains in the card", (card.match(/<MoreVertical\b/g) || []).length === 1)
check("post engagement summary uses compact unboxed spacing", card.includes('className="mx-4 mb-2 px-1 py-1"'))
check("post media height is bounded on mobile and desktop", card.includes("max-h-[24rem]") && card.includes("sm:max-h-[26rem]"))
check("story cards use responsive medium sizing", (stories.match(/h-40 w-28 sm:h-44 sm:w-32/g) || []).length >= 3)
check("story rail has tighter consistent spacing", stories.includes("gap-2.5 overflow-x-auto px-1 pb-2 scrollbar-hide"))

const failed = checks.filter((item) => !item.ok)
console.log(`\n=== RESULTS: ${checks.length - failed.length} passed, ${failed.length} failed ===`)
if (failed.length) process.exitCode = 1
