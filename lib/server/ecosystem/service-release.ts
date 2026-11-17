import { getServiceById, isInteractiveStatus } from "../../navigation/service-registry.ts"

export type EcosystemServiceAccess =
  | { allowed: true; serviceId: string; status: "ACTIVE" | "BETA" }
  | { allowed: false; serviceId: string; reason: "UNKNOWN_SERVICE" | "SERVICE_NOT_RELEASED" | "SERVICE_UNAVAILABLE" }

/**
 * Server-side release boundary for ecosystem APIs.
 * A Coming Soon card is not an access-control boundary by itself: every new
 * service API must check the canonical registry before touching user data.
 */
export function getEcosystemServiceAccess(serviceId: string): EcosystemServiceAccess {
  const id = typeof serviceId === "string" ? serviceId.trim() : ""
  const service = id ? getServiceById(id) : undefined
  if (!service) return { allowed: false, serviceId: id, reason: "UNKNOWN_SERVICE" }
  if (service.status === "UNAVAILABLE") return { allowed: false, serviceId: id, reason: "SERVICE_UNAVAILABLE" }
  if (!isInteractiveStatus(service.status)) return { allowed: false, serviceId: id, reason: "SERVICE_NOT_RELEASED" }
  return { allowed: true, serviceId: id, status: service.status as "ACTIVE" | "BETA" }
}
