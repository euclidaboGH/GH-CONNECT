"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { IdentityProvider } from "@/contexts/identity-context";
import { SessionLockProvider } from "@/contexts/session-lock-context"
import { RegionalContextProvider } from "@/contexts/regional-context";
import { SessionLockGate } from "@/components/ghc/session-lock-screen";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { ErrorBoundary } from "@/lib/error-boundary";
import { a11y } from "@/lib/accessibility";
import { offlineSupport } from "@/lib/offline";
import "@/lib/auth/install-api-auth-fetch";

/**
 * Public routes that must render without Pi sign-in (Pi Portal listing,
 * domain claim, legal compliance). Do not expand this list to app shell tabs.
 */
const PUBLIC_PATH_PREFIXES = [
  "/privacy",
  "/terms",
  "/support",
  "/portal-setup",
  "/validation-key.txt",
] as const;

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || "";
  if (path === "/" || path === "") return false;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function AccessibilitySetup() {
  useEffect(() => {
    a11y.addSkipLink();

    if (typeof document !== "undefined") {
      if (!document.getElementById("aria-live-region")) {
        const liveRegion = document.createElement("div");
        liveRegion.id = "aria-live-region";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.className = "sr-only";
        liveRegion.style.position = "absolute";
        liveRegion.style.width = "1px";
        liveRegion.style.height = "1px";
        liveRegion.style.overflow = "hidden";
        document.body.appendChild(liveRegion);
      }
    }
  }, []);

  return null;
}

function OfflineListener() {
  useEffect(() => {
    const unsubscribe = offlineSupport.setupListeners(
      () => {
        a11y.announce("Connection restored. Syncing data...", "assertive");
      },
      () => {
        a11y.announce("No internet connection. Some features may be limited.", "assertive");
      }
    );

    return unsubscribe;
  }, []);

  return null;
}

function AppContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = usePiAuth();

  // Legal / portal pages must be crawlable and open without Pi auth.
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) return <AuthLoadingScreen />;
  return <SessionLockGate>{children}</SessionLockGate>;
}

export function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <PiAuthProvider>
        <IdentityProvider>
          <SessionLockProvider>
            <RegionalContextProvider>
            <AccessibilitySetup />
            <OfflineListener />
            <AppContent>{children}</AppContent>
            </RegionalContextProvider>
          </SessionLockProvider>
        </IdentityProvider>
      </PiAuthProvider>
    </ErrorBoundary>
  );
}
