"use client"

import { UserPlus } from "lucide-react"
import type { CommunityMemberSuggestion } from "@/lib/domains/adapters/community-people-you-may-know"
import { ConnectionIntentPicker } from "./connection-intent-picker"
import { useState } from "react"
import {
  submitConnectionFromPicker,
  userFacingConnectError,
} from "@/lib/domains/adapters/connection-connect-flow"
import { IdentityService } from "@/lib/identity/identity-service"
import type { ConnectionIntentId } from "@/lib/connection-intents"

export function CommunityPeopleYouMayKnow({
  suggestions,
  communityName,
  onOpenProfile,
  blockedUserIds,
}: {
  suggestions: CommunityMemberSuggestion[]
  communityName?: string
  onOpenProfile?: (userId: string) => void
  blockedUserIds?: string[]
}) {
  const [picker, setPicker] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const me = IdentityService.getCurrentUserId()

  if (!suggestions.length) {
    return (
      <section className="rounded-2xl border border-dashed border-border px-3 py-4" aria-label="People you may know">
        <p className="text-sm font-semibold text-foreground">People you may know</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {communityName
            ? `No connection suggestions in ${communityName} yet.`
            : "No connection suggestions here yet."}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2" aria-label="People you may know in this community">
      <h3 className="px-0.5 text-[13px] font-bold text-foreground">People you may know</h3>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.userId}
            className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-2.5"
          >
            <button
              type="button"
              onClick={() => onOpenProfile?.(s.userId)}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
              aria-label={`View ${s.displayName}`}
            >
              {s.avatarUrl ? (
                <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{s.displayName.slice(0, 1)}</span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{s.displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {s.reasons.map((r) => r.detail || r.label).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setPicker({ id: s.userId, name: s.displayName })
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-full bg-teal-600 px-3 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={`Connect with ${s.displayName}`}
            >
              <UserPlus size={14} aria-hidden />
              Connect
            </button>
          </li>
        ))}
      </ul>

      <ConnectionIntentPicker
        open={!!picker}
        targetName={picker?.name}
        busy={busy}
        error={error}
        onConfirm={(result) => {
          void (async () => {
            if (!picker) return
            setBusy(true)
            setError(null)
            try {
              const r = await submitConnectionFromPicker(
                me,
                {
                  userId: picker.id,
                  displayName: picker.name,
                  source: "community",
                  blockedUserIds,
                },
                result.intents as ConnectionIntentId[],
                result.note
              )
              if (!r.ok) {
                setError(userFacingConnectError(r.code || r.error))
                return
              }
              setPicker(null)
            } catch {
              setError(userFacingConnectError("REQUEST_FAILED"))
            } finally {
              setBusy(false)
            }
          })()
        }}
        onCancel={() => {
          if (!busy) {
            setPicker(null)
            setError(null)
          }
        }}
      />
    </section>
  )
}

export default CommunityPeopleYouMayKnow
