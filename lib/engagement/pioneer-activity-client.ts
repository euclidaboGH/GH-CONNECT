/**
 * Client fire-and-forget pioneer activity (Phase 2 engagement path).
 */

import { IdentityService } from "@/lib/identity/identity-service"

export type ClientPioneerKind =
  | "session_verified"
  | "onboarding_completed"
  | "profile_updated"
  | "post_created"
  | "community_joined"
  | "message_sent"
  | "marketplace_browse"
  | "payment_completed"

export function reportPioneerActivity(kind: ClientPioneerKind): void {
  try {
    void fetch("/api/engagement/pioneer-activity", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(IdentityService.getAuthHeaders?.() || {}),
      },
      body: JSON.stringify({ kind }),
    }).catch(() => {})
  } catch {
    /* */
  }
}
