/**
 * HTTP repository adapters (compatibility entry).
 *
 * Canonical implementations live in `@/lib/domains/http-repositories`.
 * This module keeps the older `(baseUrl, getToken)` factory signatures so
 * existing backend/client code continues to compile while domains own the
 * real adapters.
 *
 * Prefer importing from `@/lib/domains` in new code.
 */

import type { Profile } from "../ghc-types"
import type {
  PostRepository,
  MessageRepository,
  ReportRepository,
  ProfileRepository,
} from "../domains/repositories"
import {
  createHttpPostRepository as createDomainHttpPostRepository,
  createHttpMessageRepository as createDomainHttpMessageRepository,
  createHttpReportRepository as createDomainHttpReportRepository,
  createHttpProfileRepository as createDomainHttpProfileRepository,
  resolveApiBaseUrl,
  type HttpRepoConfig,
} from "../domains/http-repositories"

function toConfig(baseUrl: string, getToken: () => string | null): HttpRepoConfig {
  return {
    baseUrl,
    getAuthHeaders: () => {
      const token = getToken()
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
  }
}

/** @deprecated Prefer `createHttpPostRepository` from `@/lib/domains` */
export function createHttpPostRepository(
  baseUrl: string,
  getToken: () => string | null
): PostRepository {
  return createDomainHttpPostRepository(toConfig(baseUrl, getToken))
}

/** @deprecated Prefer `createHttpMessageRepository` from `@/lib/domains` */
export function createHttpMessageRepository(
  baseUrl: string,
  getToken: () => string | null
): MessageRepository {
  return createDomainHttpMessageRepository(toConfig(baseUrl, getToken))
}

/** @deprecated Prefer `createHttpReportRepository` from `@/lib/domains` */
export function createHttpReportRepository(
  baseUrl: string,
  getToken: () => string | null
): ReportRepository {
  return createDomainHttpReportRepository(toConfig(baseUrl, getToken))
}

/** @deprecated Prefer `createHttpProfileRepository` from `@/lib/domains` */
export function createHttpProfileRepository(
  baseUrl: string,
  getToken: () => string | null,
  initial?: Profile
): ProfileRepository {
  // Domain adapter requires an initial profile snapshot
  const seed = (initial || ({ id: "current-user" } as Profile))
  return createDomainHttpProfileRepository(toConfig(baseUrl, getToken), seed)
}

/**
 * Resolve API base URL. Delegates to domain resolver, then legacy env keys.
 */
export function resolveBackendBaseUrl(): string | null {
  const fromDomain = resolveApiBaseUrl()
  if (fromDomain) return fromDomain
  try {
    const fromEnv =
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_GHC_API_URL || process.env.GHC_API_URL)) ||
      ""
    if (fromEnv && !fromEnv.includes("placeholder")) return fromEnv
  } catch {
    /* */
  }
  return null
}

export type { HttpRepoConfig }
