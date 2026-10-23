import fs from "node:fs"

const read = (p) => fs.readFileSync(p, "utf8")
const checks = []
const check = (name, ok) => { if (!ok) throw new Error(`FAIL ${name}`); checks.push(name); console.log(`PASS ${String(checks.length).padStart(2,"0")} ${name}`) }

const feed = read("components/ghc/enhanced-feed-screen.tsx")
const social = read("lib/social/client.ts")
const bell = read("components/ghc/notification-bell.tsx")
const market = read("components/ghc/marketplace-screen.tsx")
const profile = read("components/ghc/profile-identity-overview.tsx")
const empty = read("components/ghc/empty-state.tsx")

check("direct post DTO declares commentCount", /socialGetPost[\s\S]*commentCount\?: number/.test(social))
check("feed no longer reads commentCount from bare Partial<Post>", !/const raw = result\.post as Partial<Post>/.test(feed))
check("feed hydrates canonical engagement comment count", /comments: Number\(raw\.commentCount \|\| 0\)/.test(feed))
check("unified notification response declares requestId", /notifications\?: Array<\{[\s\S]*requestId\?: string \| null/.test(bell))
check("notification bell retired entityId access", !/n\.entityId/.test(bell))
check("notification bell retired entityType access", !/n\.entityType/.test(bell))
check("notification bell has one canonical unified row mapper", !/const mappedSocial: Notification\[\]/.test(bell))
check("marketplace EmptyState uses current action contract", /action=\{\{ label: "Browse marketplace", onClick: \(\) => setBucket\("browse"\) \}\}/.test(market))
check("EmptyState action object is canonical component API", /action\?: \{ label: string; onClick: \(\) => void \}/.test(empty))
check("profile refresh uses stable in-flight ref", /refreshInFlight = useRef\(false\)/.test(profile))
check("profile initial effect depends on stable refresh callback", /useEffect\(\(\) => \{ void refresh\(\) \}, \[refresh\]\)/.test(profile))
check("profile refresh callback no longer depends on loading state", /\}, \[\]\)\n\n  useEffect/.test(profile))

console.log(`\nPOST-ROADMAP HARDENING: ${checks.length}/${checks.length} passed`)
