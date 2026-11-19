import { getEcosystemServiceAccess } from "./service-release.ts"

export type OptionalProviderResult<T> =
  | { ok: true; serviceId: string; value: T }
  | { ok: false; serviceId: string; reason: "UNKNOWN_SERVICE" | "SERVICE_NOT_RELEASED" | "SERVICE_UNAVAILABLE" | "PROVIDER_FAILURE" }

/**
 * Executes an optional ecosystem provider only after the canonical release gate allows it.
 * Pass a callback containing the dynamic import and provider invocation: nothing provider-
 * specific is loaded or initialized before access is approved. Provider failures are contained
 * and returned as a typed result; callers must not turn this into core-service failure.
 */
export async function runOptionalEcosystemProvider<T>(
  serviceId: string,
  loadAndRun: () => Promise<T>,
): Promise<OptionalProviderResult<T>> {
  const access = getEcosystemServiceAccess(serviceId)
  if (!access.allowed) {
    return { ok: false, serviceId: access.serviceId, reason: access.reason }
  }

  try {
    return { ok: true, serviceId: access.serviceId, value: await loadAndRun() }
  } catch {
    return { ok: false, serviceId: access.serviceId, reason: "PROVIDER_FAILURE" }
  }
}
