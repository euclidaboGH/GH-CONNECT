/**
 * Custom hooks barrel — domain surface hooks support gradual migration
 * away from importing the full GHC context in every component.
 */
export { useImprovements } from "./useImprovements"
export { useAdvancedOptimization } from "./useAdvanced"
export { useMobileDetection } from "./use-mobile"
export { useToast } from "./use-toast"

// Domain-oriented session surfaces (thin facades over GHC context)
export { useProfileDomain } from "./useProfileDomain"
export { useFeedDomain } from "./useFeedDomain"
export { useChatDomain } from "./useChatDomain"
export { useDiscoveryDomain } from "./useDiscoveryDomain"
export { useCommunityFeatures } from "./useCommunityFeatures"
export { usePermissions } from "./usePermissions"
export { useDomainEvents } from "./useDomainEvents"
