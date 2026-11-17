/** Native-speaker approval governance for preview translation packs. */
export type TranslationReviewState = "pending_native_review" | "approved"
export const TRANSLATION_REVIEW_POLICY = {
  requiredLocales: ["ha", "ig", "yo", "pcm"] as const,
  requiredEvidence: ["nativeReviewer", "reviewedAt", "reviewedCatalogVersion", "productOwnerApproval"] as const,
  currentCatalogVersion: "7",
  previewState: "pending_native_review" as TranslationReviewState,
  approvalRule: "A locale may be marked approved only after native-speaker review, product-owner approval, and catalog-version confirmation.",
  userContentRule: "Never translate user-generated posts, private messages, profile text, listing descriptions, or community content automatically.",
  financialRule: "Never localise or recalculate amounts, currency codes, payment status, fees, wallet balances, or transaction identifiers; only static explanatory labels may be translated.",
} as const

export function canApproveTranslationReview(input: { nativeReviewer?: string; reviewedAt?: string; reviewedCatalogVersion?: string; productOwnerApproval?: boolean }): boolean {
  if (!input.nativeReviewer?.trim() || !input.reviewedAt?.trim() || !input.productOwnerApproval) return false
  if (input.reviewedCatalogVersion !== TRANSLATION_REVIEW_POLICY.currentCatalogVersion) return false
  return Number.isFinite(Date.parse(input.reviewedAt))
}
