/**
 * VerificationDomain — authenticity / legitimacy, independent of VIP/VVIP.
 *
 * Purchasing VVIP must never imply verification or trust.
 * Separate from GHC and Reputation.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"

export type VerificationType =
  | "identity"
  | "creator"
  | "business"
  | "organization"

export type VerificationStatus =
  | "none"
  | "pending"
  | "verified"
  | "rejected"
  | "revoked"

export interface VerificationRecord {
  type: VerificationType
  status: VerificationStatus
  requestedAt?: number
  verifiedAt?: number
  expiresAt?: number
  reviewerId?: string
  notes?: string
  evidenceRefs?: string[]
}

export interface VerificationSnapshot {
  userId: string
  records: Partial<Record<VerificationType, VerificationRecord>>
  /** True if any type is verified */
  anyVerified: boolean
  /** Identity verified (strongest personal authenticity signal) */
  identityVerified: boolean
  updatedAt: number
}

const STORAGE_KEY = "ghc_verification_v1"

const TYPE_LABELS: Record<VerificationType, string> = {
  identity: "Identity verified",
  creator: "Creator verified",
  business: "Business verified",
  organization: "Organization verified",
}

function loadAll(userId: string): Partial<Record<VerificationType, VerificationRecord>> {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const all = JSON.parse(raw) as Record<
      string,
      Partial<Record<VerificationType, VerificationRecord>>
    >
    return all[userId] || {}
  } catch {
    return {}
  }
}

function saveAll(
  userId: string,
  records: Partial<Record<VerificationType, VerificationRecord>>
) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = records
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function createVerificationDomain(deps: { currentUserId?: string }) {
  const userId = deps.currentUserId || "current-user"

  function snapshot(forUserId = userId): VerificationSnapshot {
    const records = loadAll(forUserId)
    const values = Object.values(records)
    const anyVerified = values.some((r) => r?.status === "verified")
    const identityVerified = records.identity?.status === "verified"
    return {
      userId: forUserId,
      records,
      anyVerified,
      identityVerified,
      updatedAt: Date.now(),
    }
  }

  return {
    getSnapshot(forUserId = userId): VerificationSnapshot {
      return snapshot(forUserId)
    },

    getRecord(type: VerificationType, forUserId = userId): VerificationRecord {
      return (
        loadAll(forUserId)[type] || {
          type,
          status: "none",
        }
      )
    },

    isVerified(type: VerificationType, forUserId = userId): boolean {
      return loadAll(forUserId)[type]?.status === "verified"
    },

    /** Any verification badge eligible for profile */
    hasAnyVerification(forUserId = userId): boolean {
      return snapshot(forUserId).anyVerified
    },

    getLabels(forUserId = userId): string[] {
      const records = loadAll(forUserId)
      return (Object.keys(records) as VerificationType[])
        .filter((t) => records[t]?.status === "verified")
        .map((t) => TYPE_LABELS[t])
    },

    async request(
      type: VerificationType,
      evidenceRefs?: string[]
    ): Promise<MutationResult<{ record: VerificationRecord }>> {
      return runMutation({
        name: "verification.request",
        actorId: userId,
        input: { type, evidenceRefs },
        validate: (i) => {
          const existing = loadAll(userId)[i.type]
          if (existing?.status === "verified") return "Already verified"
          if (existing?.status === "pending") return "Verification already pending"
          return null
        },
        mutate: (i) => {
          const records = loadAll(userId)
          const record: VerificationRecord = {
            type: i.type,
            status: "pending",
            requestedAt: Date.now(),
            evidenceRefs: i.evidenceRefs,
          }
          records[i.type] = record
          saveAll(userId, records)
          domainEvents.publish(
            "VERIFICATION_REQUESTED",
            { type: i.type },
            userId
          )
          return { record }
        },
      })
    },

    /** Admin / backend approval path */
    async approve(
      targetUserId: string,
      type: VerificationType,
      reviewerId = "system"
    ): Promise<MutationResult<{ record: VerificationRecord }>> {
      return runMutation({
        name: "verification.approve",
        actorId: reviewerId,
        input: { targetUserId, type },
        mutate: (i) => {
          const records = loadAll(i.targetUserId)
          const record: VerificationRecord = {
            type: i.type,
            status: "verified",
            requestedAt: records[i.type]?.requestedAt || Date.now(),
            verifiedAt: Date.now(),
            reviewerId,
          }
          records[i.type] = record
          saveAll(i.targetUserId, records)
          domainEvents.publish(
            "VERIFICATION_APPROVED",
            { type: i.type, userId: i.targetUserId },
            reviewerId
          )
          // Does NOT grant VIP/VVIP or reputation purchase
          return { record }
        },
      })
    },

    async reject(
      targetUserId: string,
      type: VerificationType,
      notes?: string,
      reviewerId = "system"
    ): Promise<MutationResult<{ record: VerificationRecord }>> {
      return runMutation({
        name: "verification.reject",
        actorId: reviewerId,
        input: { targetUserId, type, notes },
        mutate: (i) => {
          const records = loadAll(i.targetUserId)
          const record: VerificationRecord = {
            type: i.type,
            status: "rejected",
            requestedAt: records[i.type]?.requestedAt,
            notes: i.notes,
            reviewerId,
          }
          records[i.type] = record
          saveAll(i.targetUserId, records)
          domainEvents.publish(
            "VERIFICATION_REJECTED",
            { type: i.type, userId: i.targetUserId },
            reviewerId
          )
          return { record }
        },
      })
    },

    async revoke(
      targetUserId: string,
      type: VerificationType,
      reason: string,
      reviewerId = "system"
    ): Promise<MutationResult<{ record: VerificationRecord }>> {
      return runMutation({
        name: "verification.revoke",
        actorId: reviewerId,
        input: { targetUserId, type, reason },
        mutate: (i) => {
          const records = loadAll(i.targetUserId)
          const record: VerificationRecord = {
            ...(records[i.type] || { type: i.type, status: "none" }),
            type: i.type,
            status: "revoked",
            notes: i.reason,
            reviewerId,
          }
          records[i.type] = record
          saveAll(i.targetUserId, records)
          domainEvents.publish(
            "VERIFICATION_REVOKED",
            { type: i.type, userId: i.targetUserId },
            reviewerId
          )
          return { record }
        },
      })
    },

    /**
     * Sync profile.verified flag from identity verification only.
     * VIP purchase must never set this.
     */
    shouldShowVerifiedBadge(forUserId = userId): boolean {
      return this.isVerified("identity", forUserId) || this.isVerified("creator", forUserId)
    },
  }
}

export type VerificationDomain = ReturnType<typeof createVerificationDomain>
