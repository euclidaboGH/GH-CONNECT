import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
let passed = 0
function check(name, condition) {
  if (!condition) { console.error(`FAIL ${name}`); process.exitCode = 1; return }
  passed++
  console.log(`PASS ${name}`)
}
const workflow = fs.readFileSync(path.join(root, 'lib/i18n/workflows.ts'), 'utf8')
const review = fs.readFileSync(path.join(root, 'lib/i18n/review-governance.ts'), 'utf8')
const composer = fs.readFileSync(path.join(root, 'components/ghc/unified-compose.tsx'), 'utf8')
const profile = fs.readFileSync(path.join(root, 'components/ghc/profile-components.tsx'), 'utf8')
const marketplace = fs.readFileSync(path.join(root, 'components/ghc/marketplace-screen.tsx'), 'utf8')
const communities = fs.readFileSync(path.join(root, 'components/ghc/communities-screen.tsx'), 'utf8')
const wallet = fs.readFileSync(path.join(root, 'features/wallet/wallet-screen.tsx'), 'utf8')
check('workflow catalog exports typed keys and fallback', workflow.includes('export type WorkflowMessageKey') && workflow.includes('return WORKFLOW_MESSAGES[key]'))
check('Hausa workflow preview exists', workflow.includes('composeTitle: "Ƙirƙiri rubutu"'))
check('Igbo workflow preview exists', workflow.includes('composeTitle: "Mepụta ihe ị ga-ebipụta"'))
check('Yoruba workflow preview exists', workflow.includes('composeTitle: "Ṣẹ̀dá ìtẹ̀jáde"'))
check('Pidgin workflow preview exists', workflow.includes('composeTitle: "Create post"'))
check('composer localises publishing and offline state', composer.includes('t("composeTitle")') && composer.includes('t("composeOffline")'))
check('profile editor localises editable field labels', profile.includes('t("editProfile")') && profile.includes('t("profession")') && profile.includes('t("profileSaveError")'))
check('marketplace sell form localises safe workflow labels', marketplace.includes('wt("sellMarketplace")') && marketplace.includes('wt("price")'))
check('community board explanation is localised', communities.includes('workflow("boardPostsEvents")'))
check('wallet transaction history label is localised without changing ledger', wallet.includes('workflowText("transactionHistory")'))
check('native review requires reviewer, date, catalog version and owner approval', review.includes('nativeReviewer') && review.includes('reviewedAt') && review.includes('reviewedCatalogVersion') && review.includes('productOwnerApproval'))
check('preview locale state is pending native review', review.includes('previewState: "pending_native_review"'))
check('user-generated content translation is prohibited', review.includes('Never translate user-generated posts'))
check('financial values and payment states are protected', review.includes('Never localise or recalculate amounts'))
console.log(`Global workflow translation checks: ${passed}/14 passed`)
if (passed !== 14) process.exitCode = 1
