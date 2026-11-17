export {
  IdentityService,
  resolveCanonicalUserId,
  isStudioPlaceholderId,
  LOCAL_STUDIO_USER_ID,
  type SessionIdentity,
  type AuthState,
  type VerificationState,
  type AccountStatus,
} from "@/lib/identity/identity-service"
export {
  getSessionIdentityAliases,
  isSameIdentity,
  isOwnedByCurrentUser,
} from "@/lib/identity/identity-match"
