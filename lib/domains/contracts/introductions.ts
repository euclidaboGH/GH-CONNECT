/**
 * Introduction foundation (Prompt #40) — typed contract only.
 * No automatic introduction engine. No fake sends.
 */

export type IntroductionStatus =
  | "draft"
  | "pending_a"
  | "pending_b"
  | "accepted"
  | "declined"
  | "cancelled"

export interface IntroductionRequest {
  id: string
  introducerUserId: string
  personAUserId: string
  personBUserId: string
  reason?: string
  context?: string
  status: IntroductionStatus
  createdAt: string
  updatedAt?: string
}

export interface IntroductionDomainContract {
  /** Future: list introductions involving the current user */
  listForUser(userId: string): IntroductionRequest[]
  /** Future: propose introduction — not implemented to send */
  draft(input: Omit<IntroductionRequest, "id" | "status" | "createdAt">): IntroductionRequest
}

export const INTRODUCTIONS_NOT_IMPLEMENTED =
  "Introduction engine is contract-only. Do not auto-send introductions."
