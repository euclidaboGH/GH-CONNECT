import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
let passed = 0
function check(name, condition) { if (!condition) { console.error(`FAIL ${name}`); process.exitCode = 1; return } passed++; console.log(`PASS ${name}`) }
const catalog = fs.readFileSync(path.join(root, 'lib/i18n/social.ts'), 'utf8')
const governance = fs.readFileSync(path.join(root, 'lib/i18n/review-governance.ts'), 'utf8')
const notifications = fs.readFileSync(path.join(root, 'components/ghc/notification-bell.tsx'), 'utf8')
const videos = fs.readFileSync(path.join(root, 'components/ghc/short-video-screen.tsx'), 'utf8')
const i18n = fs.readFileSync(path.join(root, 'lib/i18n/index.ts'), 'utf8')
check('typed social catalog and English fallback', catalog.includes('export type SocialMessageKey') && catalog.includes('?? SOCIAL_MESSAGES[key]'))
check('Hausa notification and video translations', catalog.includes('notifications: "Sanarwa"') && catalog.includes('shortVideos: "Gajerun bidiyoyi"'))
check('Igbo notification and video translations', catalog.includes('notifications: "Ọkwa"') && catalog.includes('shortVideos: "Vidiyo dị mkpụmkpụ"'))
check('Yoruba notification and video translations', catalog.includes('notifications: "Àwọn ìfitónilétí"') && catalog.includes('shortVideos: "Àwọn fídíò kúkúrú"'))
check('Pidgin preview pack exists', catalog.includes('allCaughtUp: "You don check everything"'))
check('interpolation preserves unresolved tokens', catalog.includes("return template.replace(/\\{([a-zA-Z]"))
check('notification centre uses selected regional language', notifications.includes('getSocialMessage as socialText') && notifications.includes('regional.preferredLocale'))
check('notification accessibility and offline states localised', notifications.includes('t("closeNotifications")') && notifications.includes('t("offlineNotifications")'))
check('short-video controls and empty states localised', videos.includes('t("shortVideos")') && videos.includes('t("noVideos")') && videos.includes('t("mute")'))
check('short-video refreshes language callback on preference change', videos.includes('[regional.preferredLocale]') && videos.includes('[mode, seedPosts, t]'))
check('catalog version matches review governance', i18n.includes('TRANSLATION_CATALOG_VERSION = "7"') && governance.includes('currentCatalogVersion: "7"'))
check('user content and financial protections remain explicit', governance.includes('Never translate user-generated posts') && governance.includes('Never localise or recalculate amounts'))
console.log(`Global social translation checks: ${passed}/12 passed`)
if (passed !== 12) process.exitCode = 1
