/**
 * ReportDomain — universal report via mutation pipeline + repository.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import type { DomainReport } from "./types"
import type { ReportRepository } from "./repositories"

export type ReportTargetType = DomainReport["targetType"]

export function createReportDomain(deps: {
  currentUserId?: string
  repository?: ReportRepository
  onPersist?: (report: DomainReport) => void
}) {
  const actorId = deps.currentUserId || "current-user"

  return {
    async report(
      targetType: ReportTargetType,
      targetId: string,
      reason: string,
      details?: string
    ): Promise<MutationResult<DomainReport>> {
      return runMutation({
        name: "report.create",
        actorId,
        input: { targetType, targetId, reason, details },
        validate: (i) => {
          if (!i.targetId) return "Missing target"
          if (!i.reason?.trim()) return "Please choose a reason"
          return null
        },
        mutate: (i) => {
          const report: DomainReport = {
            id: `rpt_${Date.now().toString(36)}`,
            reporterId: actorId,
            targetType: i.targetType,
            targetId: i.targetId,
            reason: i.reason.trim(),
            details: i.details,
            createdAt: Date.now(),
            status: "open",
          }
          deps.repository?.create(report)
          deps.onPersist?.(report)
          return report
        },
        eventType: "REPORT_CREATED",
        eventPayload: (r) => ({
          reportId: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
        }),
      })
    },
  }
}

export type ReportDomain = ReturnType<typeof createReportDomain>
