import { buildFeedExcludeAuthorIds } from "@/lib/server/privacy-feed-contract"
/**
 * HTTP / remote repository adapters — backend-authoritative with optimistic local cache.
 * When NEXT_PUBLIC_API_URL (or window.__GHC_API_URL__) is set, domains prefer these.
 */

import type {
  Post,
  Message,
  Profile,
  Conversation,
  StoryItem,
  MatchEntry,
  FriendRequest,
} from "../ghc-types"
import type { DomainReport } from "./types"
import type {
  PostRepository,
  MessageRepository,
  ReportRepository,
  ProfileRepository,
  ConversationRepository,
  StoryRepository,
  SocialGraphRepository,
  SocialGraphSnapshotData,
} from "./repositories"
import type { GhcTransferIntent, GhcTransferResult } from "./economy-transfer-contract"
import { mapTransferFailure, toTransferHttpBody } from "./economy-transfer-contract"

export interface HttpRepoConfig {
  baseUrl: string
  getAuthHeaders?: () => Record<string, string>
  fetchImpl?: typeof fetch
}

function headers(cfg: HttpRepoConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(cfg.getAuthHeaders?.() || {}),
  }
}

async function req<T>(
  cfg: HttpRepoConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const fetchFn = cfg.fetchImpl || fetch
  const res = await fetchFn(`${cfg.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...headers(cfg), ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Queue failed writes for later retry (offline strategy) */
const pendingWrites: Array<{ path: string; init: RequestInit; at: number }> = []

function enqueueWrite(cfg: HttpRepoConfig, path: string, init: RequestInit) {
  pendingWrites.push({ path, init, at: Date.now() })
  if (pendingWrites.length > 200) pendingWrites.shift()
}

export async function flushPendingRepositoryWrites(cfg: HttpRepoConfig): Promise<number> {
  let ok = 0
  const batch = [...pendingWrites]
  pendingWrites.length = 0
  for (const item of batch) {
    try {
      await req(cfg, item.path, item.init)
      ok++
    } catch {
      pendingWrites.push(item)
    }
  }
  return ok
}

function fireWrite(cfg: HttpRepoConfig, path: string, init: RequestInit) {
  void req(cfg, path, init).catch(() => {
    enqueueWrite(cfg, path, init)
    console.warn("[http-repo] write queued offline", path)
  })
}

export function createHttpPostRepository(cfg: HttpRepoConfig): PostRepository & {
  hydrate: () => Promise<void>
} {
  let cache: Post[] = []
  return {
    list: () => cache,
    get: (id) => cache.find((p) => p.id === id),
    save: (post) => {
      cache = [post, ...cache.filter((p) => p.id !== post.id)]
      fireWrite(cfg, "/posts", { method: "POST", body: JSON.stringify(post) })
    },
    update: (id, patch) => {
      cache = cache.map((p) => (p.id === id ? { ...p, ...patch } : p))
      fireWrite(cfg, `/posts/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
    },
    hydrate: async () => {
      try {
        cache = await req<Post[]>(cfg, "/posts")
      } catch (e) {
        console.warn("[http-post] hydrate", e)
      }
    },
  }
}

export function createHttpMessageRepository(cfg: HttpRepoConfig): MessageRepository & {
  hydrateConversation: (conversationId: string) => Promise<Message[]>
} {
  const byConv = new Map<string, Message[]>()
  return {
    listByConversation: (conversationId) => byConv.get(conversationId) || [],
    append: (conversationId, message) => {
      const list = [...(byConv.get(conversationId) || []), message]
      byConv.set(conversationId, list)
      fireWrite(cfg, `/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(message),
      })
    },
    update: (conversationId, messageId, patch) => {
      const list = (byConv.get(conversationId) || []).map((m) =>
        m.id === messageId ? { ...m, ...patch } : m
      )
      byConv.set(conversationId, list)
      fireWrite(cfg, `/conversations/${conversationId}/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    },
    hydrateConversation: async (conversationId) => {
      try {
        const messages = await req<Message[]>(
          cfg,
          `/conversations/${conversationId}/messages`
        )
        byConv.set(conversationId, messages)
        return messages
      } catch (e) {
        console.warn("[http-msg] hydrate", e)
        return byConv.get(conversationId) || []
      }
    },
  }
}

export function createHttpConversationRepository(
  cfg: HttpRepoConfig
): ConversationRepository & { hydrate: () => Promise<void> } {
  let cache: Conversation[] = []
  return {
    list: () => cache,
    get: (id) => cache.find((c) => c.id === id),
    save: (conversation) => {
      const exists = cache.some((c) => c.id === conversation.id)
      cache = exists
        ? cache.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
        : [conversation, ...cache]
      fireWrite(cfg, "/conversations", {
        method: "POST",
        body: JSON.stringify(conversation),
      })
    },
    update: (id, patch) => {
      cache = cache.map((c) => (c.id === id ? { ...c, ...patch } : c))
      fireWrite(cfg, `/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    },
    hydrate: async () => {
      try {
        cache = await req<Conversation[]>(cfg, "/conversations")
      } catch (e) {
        console.warn("[http-conv] hydrate", e)
      }
    },
  }
}

export function createHttpStoryRepository(
  cfg: HttpRepoConfig
): StoryRepository & { hydrate: () => Promise<void> } {
  let cache: StoryItem[] = []
  return {
    list: () => cache,
    save: (story) => {
      cache = [story, ...cache.filter((s) => s.id !== story.id)]
      fireWrite(cfg, "/stories", { method: "POST", body: JSON.stringify(story) })
    },
    update: (id, patch) => {
      cache = cache.map((s) => (s.id === id ? { ...s, ...patch } : s))
      fireWrite(cfg, `/stories/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
    },
    remove: (id) => {
      cache = cache.filter((s) => s.id !== id)
      fireWrite(cfg, `/stories/${id}`, { method: "DELETE" })
    },
    hydrate: async () => {
      try {
        cache = await req<StoryItem[]>(cfg, "/stories")
      } catch (e) {
        console.warn("[http-story] hydrate", e)
      }
    },
  }
}

export function createHttpSocialGraphRepository(
  cfg: HttpRepoConfig,
  initial?: Partial<SocialGraphSnapshotData>
): SocialGraphRepository & { hydrate: () => Promise<SocialGraphSnapshotData | null> } {
  let snap: SocialGraphSnapshotData = {
    following: [],
    followers: [],
    friends: [],
    blockedUsers: [],
    mutedUsers: [],
    restrictedUsers: [],
    matches: [],
    friendRequests: [],
    ...initial,
  }
  return {
    getSnapshot: () => snap,
    applyPatch: (patch) => {
      snap = { ...snap, ...patch }
      fireWrite(cfg, "/social/snapshot", {
        method: "PUT",
        body: JSON.stringify(snap),
      })
    },
    recordEdge: (input) => {
      fireWrite(cfg, "/social/edges", {
        method: "POST",
        body: JSON.stringify(input),
      })
    },
    hydrate: async () => {
      try {
        const remote = await req<SocialGraphSnapshotData>(cfg, "/social/snapshot")
        snap = { ...snap, ...remote }
        return snap
      } catch (e) {
        console.warn("[http-social] hydrate", e)
        return null
      }
    },
  }
}

export function createHttpReportRepository(cfg: HttpRepoConfig): ReportRepository {
  const local: DomainReport[] = []
  return {
    create: (report) => {
      local.push(report)
      fireWrite(cfg, "/reports", { method: "POST", body: JSON.stringify(report) })
    },
    list: () => local,
  }
}

export function createHttpProfileRepository(
  cfg: HttpRepoConfig,
  initial: Profile
): ProfileRepository & { hydrate: () => Promise<Profile | null> } {
  let profile = initial
  return {
    get: () => profile,
    update: (patch) => {
      profile = { ...profile, ...patch }
      fireWrite(cfg, "/profile", { method: "PATCH", body: JSON.stringify(patch) })
    },
    hydrate: async () => {
      try {
        profile = await req<Profile>(cfg, "/profile")
        return profile
      } catch (e) {
        console.warn("[http-profile] hydrate", e)
        return null
      }
    },
  }
}

/**
 * Optional bootstrap: when NEXT_PUBLIC_API_URL is set, prefer HTTP adapters.
 */


/** Backend-authoritative economy ledger (wallet balances, rewards, premium) */
export function createHttpEconomyRepository(cfg: HttpRepoConfig): import("./economy-domain").EconomyRepository {
  const localTx: import("./economy-types").GhcTransaction[] = []
  const localRewards: import("./economy-types").RewardRecord[] = []
  let premium: import("./economy-types").PremiumMembership | null = null
  /** Max createdAt seen from last successful hydrate — avoid stale overwrite */
  let ledgerWatermark = 0
  const transferRequests: import("./economy-types").GhcTransferRequest[] = []

  return {
    mode: "server" as const,

    listTransactions(userId) {
      return localTx.filter((t) => t.userId === userId)
    },

    appendTransaction(tx) {
      // Cache-only merge after server success — never POST transfer_in as authority
      const exists = localTx.some((t) => t.id === tx.id)
      if (!exists) localTx.push(tx)
      if (tx.kind === "transfer_in" || tx.kind === "transfer_out") {
        // Money legs only via executeTransfer / server hydrate
        return
      }
      fireWrite(cfg, "/economy/transactions", {
        method: "POST",
        body: JSON.stringify(tx),
      })
    },

    /**
     * Intentionally NOT used for HTTP money moves.
     * Domain must call executeTransfer in server mode.
     */
    appendTransferPair(_debit, _credit) {
      if (typeof console !== "undefined") {
        console.warn(
          "[http-economy] appendTransferPair ignored in server mode — use executeTransfer / POST /economy/transfers"
        )
      }
    },

    async executeTransfer(intent: GhcTransferIntent): Promise<GhcTransferResult> {
      try {
        const body = toTransferHttpBody(intent)
        const data = await req<{
          referenceId?: string
          idempotent?: boolean
          debitTx?: import("./economy-types").GhcTransaction
          creditTx?: import("./economy-types").GhcTransaction
          debit?: import("./economy-types").GhcTransaction
          credit?: import("./economy-types").GhcTransaction
          wallet?: import("./economy-types").GhcWalletSnapshot
          error?: string
          code?: string
        }>(cfg, "/economy/transfers", {
          method: "POST",
          body: JSON.stringify(body),
        })
        const debitTx = data.debitTx || data.debit
        const creditTx = data.creditTx || data.credit
        if (!debitTx || !creditTx) {
          return {
            ok: false,
            error: mapTransferFailure(data.error || "Invalid server transfer response"),
          }
        }
        // Merge cache only after confirmed server result
        if (!localTx.some((t) => t.id === debitTx.id)) localTx.push(debitTx)
        if (!localTx.some((t) => t.id === creditTx.id)) localTx.push(creditTx)
        return {
          ok: true,
          idempotent: Boolean(data.idempotent),
          referenceId: data.referenceId || intent.referenceId,
          debitTx,
          creditTx,
          wallet: data.wallet,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "SERVER_UNAVAILABLE"
        // Timeout / network: do not invent local success
        return {
          ok: false,
          error: mapTransferFailure(msg, msg.toLowerCase().includes("timeout") ? "NETWORK_TIMEOUT" : "SERVER_UNAVAILABLE"),
        }
      }
    },

    async findTransferByReference(userId, referenceId) {
      const localDebit = localTx.find(
        (t) => t.userId === userId && t.referenceId === referenceId && t.kind === "transfer_out"
      )
      const localCredit = localTx.find(
        (t) => t.referenceId === referenceId && t.kind === "transfer_in"
      )
      if (localDebit) return { debit: localDebit, credit: localCredit }
      try {
        const data = await req<{
          debit?: import("./economy-types").GhcTransaction
          credit?: import("./economy-types").GhcTransaction
          debitTx?: import("./economy-types").GhcTransaction
          creditTx?: import("./economy-types").GhcTransaction
        }>(cfg, `/economy/transfers/${encodeURIComponent(referenceId)}`)
        const debit = data.debitTx || data.debit
        const credit = data.creditTx || data.credit
        if (debit && !localTx.some((t) => t.id === debit.id)) localTx.push(debit)
        if (credit && !localTx.some((t) => t.id === credit.id)) localTx.push(credit)
        return debit || credit ? { debit, credit } : null
      } catch {
        return null
      }
    },

    updateTransaction(userId, id, patch) {
      const idx = localTx.findIndex((t) => t.id === id && t.userId === userId)
      if (idx >= 0) {
        localTx[idx] = {
          ...localTx[idx],
          ...patch,
          metadata: { ...(localTx[idx].metadata || {}), ...(patch.metadata || {}) },
        }
      }
      fireWrite(cfg, `/economy/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    },

    async listTransferRequests(userId, direction) {
      try {
        const q =
          direction === "all"
            ? ""
            : `?direction=${encodeURIComponent(direction)}`
        const data = await req<{
          requests?: import("./economy-types").GhcTransferRequest[]
        }>(cfg, `/economy/transfer-requests/${encodeURIComponent(userId)}${q}`)
        if (data.requests) {
          transferRequests.length = 0
          transferRequests.push(...data.requests)
          return data.requests
        }
      } catch (e) {
        if (typeof console !== "undefined") {
          console.warn("[http-economy] listTransferRequests", e)
        }
      }
      return transferRequests.filter((r) => {
        if (direction === "incoming") return r.payerId === userId
        if (direction === "outgoing") return r.requesterId === userId
        return r.payerId === userId || r.requesterId === userId
      })
    },

    async upsertTransferRequest(request) {
      const idx = transferRequests.findIndex((r) => r.referenceId === request.referenceId)
      if (idx >= 0) transferRequests[idx] = request
      else transferRequests.push(request)
      fireWrite(cfg, "/economy/transfer-requests", {
        method: "POST",
        body: JSON.stringify(request),
      })
    },

    listRewards(userId) {
      return localRewards.filter((r) => r.userId === userId)
    },
    appendReward(reward) {
      localRewards.push(reward)
      fireWrite(cfg, "/economy/rewards", {
        method: "POST",
        body: JSON.stringify(reward),
      })
    },
    updateReward(id, patch) {
      const idx = localRewards.findIndex((r) => r.id === id)
      if (idx >= 0) localRewards[idx] = { ...localRewards[idx], ...patch }
      fireWrite(cfg, `/economy/rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    },
    getPremium(userId) {
      return premium && premium.userId === userId ? premium : null
    },
    setPremium(membership) {
      premium = membership
      fireWrite(cfg, "/economy/premium", {
        method: "PUT",
        body: JSON.stringify(membership),
      })
    },

    hydrate: async (userId) => {
      try {
        const data = await req<{
          transactions?: import("./economy-types").GhcTransaction[]
          rewards?: import("./economy-types").RewardRecord[]
          premium?: import("./economy-types").PremiumMembership | null
          transferRequests?: import("./economy-types").GhcTransferRequest[]
          updatedAt?: number
        }>(cfg, `/economy/wallet/${userId}`)
        const serverMax = Math.max(
          0,
          ...(data.transactions || []).map((x) => x.createdAt || 0),
          data.updatedAt || 0
        )
        // Do not wipe newer local cache with older server snapshot
        if (serverMax > 0 && serverMax < ledgerWatermark) {
          if (typeof console !== "undefined") {
            console.warn("[http-economy] hydrate skipped — local watermark newer than server")
          }
          return
        }
        if (data.transactions) {
          // Merge by id: prefer server rows, keep local-only newer ids if any
          const byId = new Map<string, import("./economy-types").GhcTransaction>()
          for (const t of localTx) byId.set(t.id, t)
          for (const t of data.transactions) byId.set(t.id, t)
          localTx.length = 0
          localTx.push(...byId.values())
          ledgerWatermark = Math.max(ledgerWatermark, serverMax)
        }
        if (data.rewards) {
          localRewards.length = 0
          localRewards.push(...data.rewards)
        }
        if (data.premium !== undefined) premium = data.premium
        if (data.transferRequests) {
          transferRequests.length = 0
          transferRequests.push(...data.transferRequests)
        }
      } catch (e) {
        console.warn("[http-economy] hydrate", e)
      }
    },
  }
}

export function resolveApiBaseUrl(): string | null {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    const w = (window as any).__GHC_API_URL__
    if (typeof w === "string" && w.length > 0) return w
  }
  return null
}
