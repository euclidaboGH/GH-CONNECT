#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const docsRoot = join(root, 'docs')
const required = new Set([
  'docs/SOURCE_OF_TRUTH.md',
  'docs/CURRENT_BUILD_CONTEXT.md',
  'docs/PHASE-26-WALLET-LEDGER-RESILIENCE-2026-11-04.md',
  'docs/PHASE-1-CRITICAL-INTEGRITY-IMPLEMENTATION-2026-11-04.md',
  'docs/VERCEL-BUILD-AND-DEPENDENCY-REVIEW-2026-11-04.md',
  'docs/REPOSITORY-CONSISTENCY-AND-TYPESCRIPT-REMEDIATION-2026-11-04.md',
  'docs/UPGRADE-WORKLOG-0.311.0.md',
  'docs/UPGRADE-WORKLOG-0.313.1.md',
  'docs/UPGRADE-WORKLOG-0.315.4.md',
  'docs/PHASE-1-SOCIAL-FOUNDATION-0.315.5.md',
  'docs/UPGRADE-WORKLOG-0.315.5.md',
  'docs/UPGRADE-WORKLOG-0.315.6.md',
  'docs/PHASE-1-DEEP-COMPLETION-0.315.6.md',
  'docs/PHASE-2-STORIES-PREMIUM-REBUILD-0.315.7.md',
  'docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md',
  'docs/UPGRADE-WORKLOG-0.315.8.md',
  'docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md',
  'docs/UPGRADE-WORKLOG-0.315.9.md',
  'docs/PHASE-6-PROFILE-IDENTITY-PERFORMANCE-UPGRADE-0.317.0.md',
  'docs/PHASE-6-PROFILE-IDENTITY-PERFORMANCE-UPGRADE-0.318.0.md',
  'docs/PHASE-7-PREMIUM-PROFILE-IDENTITY-EXPERIENCE-0.318.0.md',
  'docs/PHASE-7-CREATOR-BUSINESS-IDENTITY-AND-PORTFOLIO-0.319.0.md',
  'docs/UPGRADE-WORKLOG-0.317.0.md',
  'docs/UPGRADE-WORKLOG-0.318.0.md',
  'docs/UPGRADE-WORKLOG-0.319.0.md',
  'docs/UPGRADE-WORKLOG-0.320.0.md',
  'docs/PHASE-8-REWARDS-INTEGRITY-AND-EXPERIENCE-0.321.0.md',
  'docs/UPGRADE-WORKLOG-0.321.0.md',
  'docs/PHASE-8-REWARDS-PREMIUM-EXPERIENCE-0.322.0.md',
  'docs/UPGRADE-WORKLOG-0.322.0.md',
  'docs/PHASE-8-REWARDS-COMPLETION-0.323.0.md',
  'docs/UPGRADE-WORKLOG-0.323.0.md',
  'docs/PHASE-9-MEMBERSHIP-FOUNDATION-0.324.0.md',
  'docs/UPGRADE-WORKLOG-0.324.0.md',
  'docs/PHASE-9-MEMBERSHIP-SESSION-INTEGRITY-0.325.0.md',
  'docs/UPGRADE-WORKLOG-0.325.0.md',
  'docs/PHASE-9-MEMBERSHIP-LIFECYCLE-AND-ACCESS-CONTROL-0.326.0.md',
  'docs/UPGRADE-WORKLOG-0.326.0.md',
  'docs/PRODUCT-ROADMAP.md', 'docs/PHASE-9-MEMBERSHIP-PI-INTENT-SECURITY-0.327.0.md', 'docs/UPGRADE-WORKLOG-0.327.0.md', 'docs/UPGRADE-WORKLOG-0.328.0.md', 'docs/UPGRADE-WORKLOG-0.329.0.md',
  'docs/UPGRADE-WORKLOG-0.316.0.md',
  'docs/PRODUCT-OVERHAUL-AUDIT-0.315.4.md',
  'docs/PHASE17_SOCIAL_ENGAGEMENT_JOURNEY.md',
  'docs/ACCOUNT_PRIVACY_MEDIA_PHASE18_0.304.0.md',
  'docs/CREATOR_ECONOMY_INTEGRITY_PHASE19_0.305.0.md',
  'docs/UPGRADE-WORKLOG-0.305.0.md',
  'docs/UPGRADE-WORKLOG-0.306.0.md',
  'docs/UPGRADE-WORKLOG-0.307.0.md',
  'docs/UPGRADE-WORKLOG-0.308.0.md',
  'docs/UPGRADE-WORKLOG-0.309.0.md',
  'docs/UPGRADE-WORKLOG-0.310.0.md',
  'docs/PHASE-24-FINAL-SOURCE-AND-MIGRATION-REVIEW-2026-11-04.md',
  'docs/PHASE-23-MIGRATION-INTEGRITY-2026-11-04.md',
  'docs/PHASE-22-MARKETPLACE-ATOMIC-TRANSITIONS-2026-11-04.md',
  'docs/PHASE-21-PRIVATE-SURFACE-DURABLE-CONTROLS-2026-11-04.md',
  'docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md',
  'docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md',
  'docs/UPGRADE-WORKLOG-0.303.0.md',
  'docs/UPGRADE-WORKLOG-0.304.0.md',
  'docs/PHASE17_SOCIAL_ENGAGEMENT_JOURNEY.md',
  'docs/POST_INTERACTIONS_PHASE16_0.302.0.md',
  'docs/FEED_EXPERIENCE_PHASE15_0.301.0.md',
  'docs/UPGRADE-WORKLOG-0.302.0.md',
  'docs/UPGRADE-WORKLOG-0.301.0.md',
  'docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md',
  'docs/PASS-44-DURABLE-ABUSE-CONTROL-HARDENING-2026-11-01.md',
  'docs/PASS-45-SECURITY-CONTROL-PLANE-RETENTION-2026-11-01.md',
  'docs/PASS-46-APP-EXPERIENCE-AND-SECURITY-RESILIENCE-2026-11-01.md',
  'docs/PASS-47-APP-EXPERIENCE-COHESION-2026-11-01.md',
  'docs/PASS-48-ACCESSIBLE-NAVIGATION-2026-11-01.md',
  'docs/PROJECT_TRUTH.md',
  'docs/MIGRATION_CHECKLIST.md',
  'docs/POLICY_REVIEW_CHECKLIST.md',
  'docs/OPERATOR_ENV_AND_STATUS.md',
  'docs/COMMUNITY_GLOBAL_STANDARD_UPGRADE_2026-10-31.md',
  'docs/PAST_2_HOUR_CONSOLIDATION_AUDIT_2026-10-31.md',
  'docs/POST_CURATION_3_PHASE_PRODUCTION_UPGRADE_2026-10-31.md',
  'docs/PRE_PUSH_MIGRATION_AUDIT_2026-10-31.md',
  'docs/REFRESH_NOTIFICATION_UPGRADE_0.222.0_2026-10-31.md',
  'docs/REGIONAL_CONTEXT_DATE_TIME_LOCATION_UPGRADE_2026-10-31.md',
  'docs/RESIDUAL-TECH-DEBT-HARDENING-2026-10-31.md',
  'docs/UPGRADE-WORKLOG-0.222.0.md',
  'docs/GLOBAL_LANGUAGE_GEOGRAPHY_FOUNDATION_0.288.0.md',
  'docs/GLOBAL_INTERNATIONALISATION_ENGINE_0.289.0.md',
  'docs/GLOBAL_LANGUAGE_PACKS_PHASE3_0.290.0.md',
  'docs/GLOBAL_PRODUCT_SURFACE_LOCALISATION_PHASE4_0.291.0.md',
  'docs/GLOBAL_WORKFLOW_LOCALISATION_PHASE6_0.293.0.md',
  'docs/GLOBAL_SOCIAL_LOCALISATION_PHASE7_0.294.0.md',
  'docs/GLOBAL_LOCALE_PRESENTATION_PHASE8_0.295.0.md',
  'docs/GLOBAL_RTL_ACCESSIBILITY_PHASE9_0.296.0.md',
  'docs/GLOBAL_ACCESSIBILITY_PHASE10_0.297.0.md',
  'docs/GLOBAL_LOCALE_INTEGRATION_PHASE12_0.298.0.md',
  'docs/SOCIAL_STORY_PROFILE_MEDIA_PHASE13_0.299.0.md',
  'docs/UPGRADE-WORKLOG-0.293.0.md',
  'docs/UPGRADE-WORKLOG-0.294.0.md',
  'docs/UPGRADE-WORKLOG-0.295.0.md',
  'docs/UPGRADE-WORKLOG-0.296.0.md',
  'docs/UPGRADE-WORKLOG-0.297.0.md',
  'docs/UPGRADE-WORKLOG-0.298.0.md',
  'docs/UPGRADE-WORKLOG-0.299.0.md',
  'docs/UPGRADE-WORKLOG-0.300.0.md',
  'docs/translation-review/PHASE6-REVIEW-REGISTER-0.293.0.csv',
  'docs/translation-review/PHASE9-REVIEW-REGISTER-0.296.0.csv',
  'docs/translation-review/PHASE10-REVIEW-REGISTER-0.297.0.csv',
  'docs/GLOBAL_EXPERIENCE_LOCALISATION_PHASE5_0.292.0.md',
  'docs/UPGRADE-WORKLOG-0.292.0.md',
  'docs/UPGRADE-WORKLOG-0.291.0.md',
  'docs/UPGRADE-WORKLOG-0.290.0.md',
  'docs/CI_FIX_0.287.0_STATIC-WALLET-TYPESCRIPT-WARNING.md',
  'docs/UPGRADE-WORKLOG-0.288.0.md',
  'docs/UPGRADE-WORKLOG-0.289.0.md',
  'docs/WALLET_NOTIFICATION_AUDIT_0.222.0_2026-10-31.md',
])
const failures=[]
const walk=(dir)=>{
  for(const name of readdirSync(dir)){
    const p=join(dir,name)
    const rel=relative(root,p).replaceAll('\\','/')
    if(statSync(p).isDirectory()) walk(p)
    else if(rel.endsWith('.md') || rel.endsWith('.json') || rel.endsWith('.csv')) {
      if(rel === 'docs/PHASE-03-RESTORE-EVIDENCE-TEMPLATE.json' || rel === 'docs/architecture/PRODUCTION_VERIFICATION_REPORT.json') continue
      const s=readFileSync(p,'utf8')
      if(!required.has(rel) && !s.startsWith('> **LEGACY VERIFICATION FIXTURE')) {
        // Non-required docs must be explicitly current; this prevents silent historical-document growth.
        // Allow: Pass48 baseline date, intermediate worklogs, and active Nov-2026 engineering notes.
        const currentWorklog = rel === `docs/UPGRADE-WORKLOG-${pkg.version}.md`
        const datedCurrent = /2026-10-31|2026-11-0[1-5]|0\.222\.0|0\.26[5-9]|0\.27[0-5]|0\.312\.0|0\.313\.\d+/.test(s) || /0\.27[0-5]\.\d/.test(s)
        if(!currentWorklog && !datedCurrent) failures.push(`unclassified documentation: ${rel}`)
      }
    }
  }
}
walk(docsRoot)
for(const p of required) if(!existsSync(join(root,p))) failures.push(`missing canonical document: ${p}`)
if(!readFileSync(join(root,'README.md'),'utf8').includes(`Current source version:** \`${pkg.version}\``)) failures.push('README current version marker missing')
if(!readFileSync(join(root,'docs/PROJECT_TRUTH.md'),'utf8').includes(`**Current source version:** \`${pkg.version}\``)) failures.push('PROJECT_TRUTH current version marker missing')
if(!readFileSync(join(root,'docs/SOURCE_OF_TRUTH.md'),'utf8').includes('legacy documents')) failures.push('SOURCE_OF_TRUTH legacy-document rule missing')
if(failures.length){ console.error(`Documentation hygiene: ${failures.length} failure(s)`); for(const f of failures) console.error(`FAIL ${f}`); process.exit(1) }
console.log('Documentation hygiene: PASS (legacy noise isolated/marked and current source-of-truth documents present)')
