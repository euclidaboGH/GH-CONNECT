/**
 * @deprecated LEGACY — not mounted by production App shell.
 * Active home surface: EnhancedFeedScreen via components/ghc/app.tsx.
 * Do not wire new features here. Kept only for module-graph compatibility.
 */
"use client"

/**
 * Screen barrel — dedicated modules so a parse error in one
 * cannot take down Discover + Messages + Profile together.
 */
export { HomeScreen } from "./home-screen-stub"
export { DiscoveryGridScreen } from "./discovery-grid-screen"
export { MatchScreen } from "./match-screen"
export { MessageScreen } from "./message-screen"
export { ProfileScreen } from "./profile-screen"
export { CommunitiesScreen } from "./communities-screen"
