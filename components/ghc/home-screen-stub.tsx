/**
 * @deprecated LEGACY — not mounted by production App shell.
 * Active home surface: EnhancedFeedScreen via components/ghc/app.tsx.
 * Do not wire new features here. Kept only for module-graph compatibility.
 */
"use client"

/**
 * Compatibility alias — Home is EnhancedFeedScreen (command centre feed).
 * Prefer importing EnhancedFeedScreen / lazy path from app shell.
 */
export { default as HomeScreen, default as EnhancedFeedScreen } from "./enhanced-feed-screen"
